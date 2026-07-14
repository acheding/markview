import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { decodeShareHash, encodeSharePayload } from '../core/share/shareLink.js'
import { buildAnchorTable } from '../core/sync/anchorMap.js'
import { createScrollMaster } from '../core/sync/scrollMaster.js'
import { createEditorController } from '../editor/EditorController.js'
import { createPreviewController } from '../preview/PreviewController.js'
import { exportMarkdown, exportPdf } from '../services/exporter.js'
import { SAVE_STATUS } from '../core/documents/persistenceScheduler.js'
import { createDocumentSession } from './documentSession.js'
import { createSearchSession } from './searchSession.js'
import { createLayoutSession } from './layoutSession.js'
import { createHeadingNavigation } from './headingNavigation.js'
import { createOrchestrations } from './orchestrations.js'
import { createToastSession } from './toastSession.js'
import { createConfirmSession } from './confirmSession.js'
import { createPreviewRenderSession } from './previewRenderSession.js'
import { useTheme } from '../composables/useTheme.js'
import { copyText } from '../composables/clipboard.js'
import { waitForAnimationFrame } from '../composables/useTransitionSettled.js'

const getElementTop = (container, element) => {
    const containerRect = container.getBoundingClientRect()
    const elementRect = element.getBoundingClientRect()
    return container.scrollTop + elementRect.top - containerRect.top
}

// 在 App 根部组装整个工作区：会话（响应式状态）+ 控制器（命令式门面）+ 编排 + 生命周期。
// 通过 provide 下发，任何组件 useWorkspace() 直接消费。
export const createWorkspace = () => {
    // 另一标签页写入被协调后：丢弃过期文档的编辑器缓存态，并把外部更新推回当前编辑视图。
    const documents = createDocumentSession({
        onExternalUpdate: ({ activeContent, forgetIds }) => {
            forgetIds?.forEach((id) => editorController?.forgetDocument(id))
            // setDoc 内容与内存态一致，其触发的 onDocChanged 会因内容相同而空转，不产生保存回环。
            if (activeContent != null) editorController?.setDoc(activeContent)
        }
    })
    const search = createSearchSession({ files: documents.files, activeFileId: documents.activeFileId })
    const layout = createLayoutSession()
    const toast = createToastSession()
    const confirm = createConfirmSession()
    const { theme } = useTheme()

    // 渲染在 Web Worker 中进行，结果异步写回 html/toc。
    const html = ref('')
    const toc = ref([])
    // 首屏 hydrate 完成（isReady）后编辑器立即出内容，但预览需等 Worker 渲染 + 后处理，
    // 用该标记让预览区在初次发布前保留骨架屏，避免右侧长时间空白。
    const isPreviewReady = ref(false)
    let latestRenderSequence = 0
    let editorController = null
    let previewController = null
    let scrollMaster = null
    let previewCommitUpdating = false
    let renderRevision = 0

    const containsMermaid = (value) => String(value || '').includes('class="mermaid-block"')

    const publishPreview = async (result) => {
        const preserveViewport = Boolean(
            previewController && (containsMermaid(html.value) || containsMermaid(result.html))
        )
        const viewportSnapshot = preserveViewport ? previewController.captureViewport() : null
        previewCommitUpdating = preserveViewport

        try {
            html.value = result.html
            toc.value = result.toc
            isPreviewReady.value = true
            renderRevision += 1
            await nextTick()

            previewController?.invalidate()
            editorController?.setSearchHighlight(search.activeMatch.value)
            previewController?.setSearchHighlight(search.activeMatch.value)
            if (preserveViewport) previewController?.restoreViewport(viewportSnapshot)
            headings.updateActiveHeading()

            if (preserveViewport) await waitForAnimationFrame()
        } finally {
            scrollMaster?.reset()
            previewCommitUpdating = false
        }
    }

    const previewRenderer = createPreviewRenderSession({
        onResult: publishPreview,
        getTheme: () => theme.value
    })
    watch(
        () => documents.content.value,
        (source) => {
            latestRenderSequence = previewRenderer.render(source ?? '')
        },
        { immediate: true }
    )

    const waitForPreviewReady = async () => {
        return previewRenderer.whenPublished(latestRenderSequence)
    }

    // —— 命令式控制器（挂载时创建） ——
    let anchorCache = { signature: '', anchors: null }

    const getEditor = () => editorController
    const getPreview = () => previewController
    const getScrollMaster = () => scrollMaster

    const headings = createHeadingNavigation({ toc, getPreviewController: getPreview })

    const buildAnchors = () => {
        if (!editorController || !previewController) return []
        const editorEl = editorController.scrollDOM
        const previewEl = previewController.scrollDOM

        const signature = [
            renderRevision,
            editorController.docLength(),
            editorEl.scrollHeight,
            editorEl.clientWidth,
            editorEl.clientHeight,
            previewEl.scrollHeight,
            previewEl.clientWidth,
            previewEl.clientHeight
        ].join('|')

        if (anchorCache.signature === signature && anchorCache.anchors) return anchorCache.anchors

        const pairs = previewController.sourceBlocks().map((block) => ({
            editor: editorController.lineTop(block.line),
            preview: getElementTop(previewEl, block.element)
        }))

        anchorCache = {
            signature,
            anchors: buildAnchorTable({
                pairs,
                editorMax: Math.max(0, editorEl.scrollHeight - editorEl.clientHeight),
                previewMax: Math.max(0, previewEl.scrollHeight - previewEl.clientHeight)
            })
        }
        return anchorCache.anchors
    }

    const ensureScrollMaster = () => {
        if (scrollMaster || !editorController || !previewController) return
        const scrollAdapter = (getController) => ({
            getScrollTop: () => getController().scrollDOM.scrollTop,
            getMaxScrollTop: () => {
                const el = getController().scrollDOM
                return Math.max(0, el.scrollHeight - el.clientHeight)
            },
            getClientHeight: () => getController().scrollDOM.clientHeight,
            setScrollTop: (top) => getController().scrollDOM.scrollTo({ top, behavior: 'auto' })
        })
        scrollMaster = createScrollMaster({
            editor: scrollAdapter(getEditor),
            preview: scrollAdapter(getPreview),
            getAnchors: buildAnchors,
            isEnabled: () => layout.isScrollSyncEnabled.value
        })
    }

    // 导航滚动锁：TOC/锚点/回顶触发的是预览区「平滑」滚动，会逐帧驱动编辑器跟随；
    // 但编辑器跟随时产生的 scroll 事件不得反向回弹到预览区，否则会用瞬时跳转打断平滑动画
    // （表现为「滚到一半卡住」）。导航期间锁定滚动源为预览区，滚动结束（scrollend）即释放。
    let syncOwner = null
    let navReleaseTimer = null
    let navScrollEndTarget = null
    let navScrollEndHandler = null

    const releaseNavLock = () => {
        if (!syncOwner) return
        syncOwner = null
        headings.endNavigation()
        scrollMaster?.reset()
        clearTimeout(navReleaseTimer)
        navReleaseTimer = null
        if (navScrollEndTarget && navScrollEndHandler) {
            navScrollEndTarget.removeEventListener('scrollend', navScrollEndHandler)
        }
        navScrollEndTarget = null
        navScrollEndHandler = null
    }

    // 组件在发起预览区平滑导航滚动「之前」调用。
    const beginPreviewNavigation = () => {
        if (!previewController) return
        releaseNavLock()
        syncOwner = 'preview'
        scrollMaster?.reset()
        navScrollEndTarget = previewController.scrollDOM
        navScrollEndHandler = releaseNavLock
        navScrollEndTarget.addEventListener('scrollend', navScrollEndHandler, { once: true })
        // 安全兜底：scrollend 不支持/未触发时也释放，避免锁死联动。
        navReleaseTimer = setTimeout(releaseNavLock, 1200)
    }

    const handleEditorScroll = () => {
        if (previewCommitUpdating) return
        if (syncOwner && syncOwner !== 'editor') return
        scrollMaster?.handleScroll('editor')
    }
    const handlePreviewScroll = () => {
        if (previewCommitUpdating) return
        if (syncOwner && syncOwner !== 'preview') {
            headings.updateActiveHeading()
            return
        }
        scrollMaster?.handleScroll('preview')
        headings.updateActiveHeading()
    }

    // —— 挂载/卸载控制器 ——
    const attachEditor = (hostEl) => {
        editorController = createEditorController({
            parent: hostEl,
            docId: documents.activeFileId.value,
            doc: documents.content.value,
            onDocChanged: (text) => documents.setContent(text),
            onUserIntent: () => search.clearActiveMatch(),
            onScroll: handleEditorScroll,
            onImageNotify: (message) => toast.show(message, { tone: 'warn', duration: 3000 }),
            completion: {
                getHeadings: () => toc.value,
                getDocuments: () => documents.files.value
            }
        })
        editorController.setSearchHighlight(search.activeMatch.value)
        ensureScrollMaster()
        if (!layout.isEditorCollapsed.value) editorController.focus()
    }
    const detachEditor = () => {
        editorController?.destroy()
        editorController = null
        scrollMaster = null
    }
    const attachPreview = (contentEl) => {
        previewController = createPreviewController({ contentEl })
        previewController.setSearchHighlight(search.activeMatch.value)
        ensureScrollMaster()
    }
    const detachPreview = () => {
        previewController = null
        scrollMaster = null
    }

    const orchestrations = createOrchestrations({
        documents,
        search,
        layout,
        headings,
        confirm,
        getEditor,
        getPreview,
        getScrollMaster,
        waitForPreviewReady
    })

    // —— 导出 ——
    const isExportingPdf = ref(false)
    const exportActiveFile = () => exportMarkdown(documents.activeFile.value)
    const exportActivePdf = async () => {
        if (isExportingPdf.value || !previewController) return
        isExportingPdf.value = true
        try {
            await exportPdf(previewController.scrollDOM, documents.activeFile.value?.name)
        } catch (error) {
            console.warn('导出 PDF 失败:', error)
            alert('导出 PDF 失败，请重试。')
        } finally {
            isExportingPdf.value = false
        }
    }

    // —— 响应式联动 ——
    // 切换文档：编辑器切到该文档的独立 EditorState（各自 undo 历史），再做副作用（清搜索命中、
    // 双侧置顶、清 hash、复位标题）。用 setActiveDocument 而非整段替换，避免跨文档撤销栈污染。
    watch(
        () => documents.activeFileId.value,
        async (id, prevId) => {
            // prevId 为空 = 首屏 hydrate 的 ''→初始文档 激活，不是用户切换文档，
            // 不能清 hash/置顶（否则刷新带 #标题 的链接会被重置为裸 URL）。
            if (!documents.isReady.value || !prevId) return
            editorController?.setActiveDocument(id, documents.content.value)
            search.clearActiveMatch()
            headings.activeHeadingId.value = ''
            editorController?.scrollDOM.scrollTo({ top: 0, behavior: 'auto' })
            previewController?.scrollDOM.scrollTo({ top: 0, behavior: 'auto' })
            headings.clearHash()
            await nextTick()
            headings.updateActiveHeading()
        }
    )

    // 文档被删除 → 丢弃编辑器中保存的对应 EditorState。
    watch(
        () => documents.files.value,
        (files, prevFiles) => {
            if (!editorController || !prevFiles) return
            const ids = new Set(files.map((file) => file.id))
            prevFiles.forEach((file) => {
                if (!ids.has(file.id)) editorController.forgetDocument(file.id)
            })
        }
    )

    // 搜索命中本身变化时只更新两侧高亮；HTML 原子发布后会显式恢复一次高亮。
    watch(
        () => search.activeMatch.value,
        () => {
            editorController?.setSearchHighlight(search.activeMatch.value)
            previewController?.setSearchHighlight(search.activeMatch.value)
            headings.updateActiveHeading()
        },
        { flush: 'post' }
    )

    // 用最新 Worker 原始结果离屏重建主题对应的 Mermaid SVG，再原子发布。
    watch(theme, () => previewRenderer.refresh())

    // 分享链接（#share=…）→ 解压为新文档导入，并清掉 share hash（避免刷新重复导入）。
    // 不在此写回标题锚点：导入会切换活动文档、触发文档切换副作用（含 clearHash），
    // 此刻写的锚点会被清掉。锚点由调用方在切换副作用结束后写回。返回解码结果（含 anchor）。
    const importSharedFromHash = () => {
        const shared = decodeShareHash(window.location.hash)
        if (!shared) return null
        documents.importFile({ name: shared.name, content: shared.content })
        history.replaceState(null, '', window.location.pathname + window.location.search)
        toast.show('已打开分享的文档', { tone: 'success' })
        return shared
    }

    // 把当前文档压缩进 URL hash，复制到剪贴板。链接自包含、无需后端。
    // 传入 anchor（标题 id）时生成「定位分享链接」：既含原文档、又直达该标题。
    const shareActiveDocument = async (anchor) => {
        // 通过 @click 直接绑定时首参会是 MouseEvent，仅接受字符串锚点。
        const anchorId = typeof anchor === 'string' && anchor ? anchor : null
        const name = documents.activeFile.value?.name || '未命名文档.md'
        const compressed = encodeSharePayload({ name, content: documents.content.value, anchor: anchorId })
        const url = new URL(window.location.href)
        url.hash = `share=${compressed}`
        const link = url.toString()

        if (await copyText(link)) {
            // hash 不会发到服务器，故不受 8KB URL 限制；真正的上限是浏览器地址栏（Safari 约 8 万字符最保守）
            // 与聊天软件粘贴截断，故阈值放宽到 5 万，超出也只是温和提示、仍复制成功。
            const isLong = link.length > 50000
            const label = anchorId ? '定位分享链接' : '分享链接'
            toast.show(isLong ? `${label}已复制（较长，可能被截断）` : `${label}已复制到剪贴板`, {
                tone: 'success',
                duration: isLong ? 3200 : 2200
            })
            return true
        }
        // 复制彻底失败：把链接写进地址栏，用户可手动复制。
        window.location.hash = `share=${compressed}`
        toast.show('已生成链接，请从地址栏手动复制', { tone: 'warn', duration: 3600 })
        return false
    }

    // 数据就绪后：先处理分享链接（导入新文档），待文档切换副作用跑完再写回锚点、等预览发布后定位。
    watch(
        () => documents.isReady.value,
        async (ready) => {
            if (!ready) return
            await nextTick()
            const shared = importSharedFromHash()
            // 等一拍让导入触发的文档切换副作用（含 clearHash、置顶）和重渲染跑完：
            // 之后再写回锚点 hash（否则会被 clearHash 清掉），并等预览真正发布——
            // 否则标题 DOM 尚不存在，定位会落空、或被随后到达的渲染把锚点挤偏一个标题。
            await nextTick()
            if (shared?.anchor) {
                const base = window.location.pathname + window.location.search
                history.replaceState(null, '', `${base}#${encodeURIComponent(shared.anchor)}`)
            }
            await waitForPreviewReady()
            headings.scrollToHashHeading()
        }
    )

    // —— 生命周期 ——
    const flushOnLeave = () => documents.flush()
    const flushOnHidden = () => {
        if (document.visibilityState === 'hidden') documents.flush()
    }
    // Ctrl/Cmd + S：拦截浏览器「保存网页」，立即落盘并提示（本应用本就自动保存到本地）。
    const saveNow = async () => {
        if (documents.saveStatus.value === SAVE_STATUS.MEMORY_ONLY) {
            toast.show('浏览器未启用本地存储，内容仅保存在当前会话', { tone: 'warn', duration: 3000 })
            return
        }
        await documents.flush()
        toast.show(documents.saveStatus.value === SAVE_STATUS.FAILED ? '保存失败，请重试' : '已保存到本地', {
            tone: documents.saveStatus.value === SAVE_STATUS.FAILED ? 'warn' : 'success'
        })
    }

    const handleKeydown = (event) => {
        if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'c') {
            event.preventDefault()
            orchestrations.clearContent()
            return
        }
        if ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 's') {
            event.preventDefault()
            saveNow()
        }
    }

    onMounted(() => {
        headings.init()
        window.addEventListener('pagehide', flushOnLeave)
        window.addEventListener('beforeunload', flushOnLeave)
        document.addEventListener('visibilitychange', flushOnHidden)
        document.addEventListener('keydown', handleKeydown)
    })

    onBeforeUnmount(() => {
        releaseNavLock()
        toast.dispose()
        confirm.dispose()
        previewRenderer.dispose()
        documents.dispose()
        headings.dispose()
        detachEditor()
        detachPreview()
        window.removeEventListener('pagehide', flushOnLeave)
        window.removeEventListener('beforeunload', flushOnLeave)
        document.removeEventListener('visibilitychange', flushOnHidden)
        document.removeEventListener('keydown', handleKeydown)
    })

    documents.hydrate()

    return {
        documents,
        search,
        layout,
        headings,
        toast,
        confirm,
        html,
        toc,
        isPreviewReady,
        exporting: {
            isExportingPdf,
            exportActiveFile,
            exportPdf: exportActivePdf
        },
        actions: orchestrations,
        share: shareActiveDocument,
        attachEditor,
        detachEditor,
        attachPreview,
        detachPreview,
        getPreview,
        handlePreviewScroll,
        beginPreviewNavigation
    }
}

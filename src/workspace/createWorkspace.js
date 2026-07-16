import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { buildAnchorTable } from '../core/sync/anchorMap.js'
import { createScrollMaster } from '../core/sync/scrollMaster.js'
import { createEditorController } from '../editor/EditorController.js'
import { createPreviewController } from '../preview/PreviewController.js'
import { exportHtml, exportMarkdown, printDocument } from '../services/exporter.js'
import { SAVE_STATUS } from '../core/documents/persistenceScheduler.js'
import { createCommands } from './commands.js'
import { createDocumentSession } from './documentSession.js'
import { createSearchSession } from './searchSession.js'
import { createLayoutSession } from './layoutSession.js'
import { createHeadingNavigation } from './headingNavigation.js'
import { createImportSession } from './importSession.js'
import { createOrchestrations } from './orchestrations.js'
import { createShareSession } from './shareSession.js'
import { createToastSession } from './toastSession.js'
import { createConfirmSession } from './confirmSession.js'
import { createPreviewRenderSession } from './previewRenderSession.js'
import { matchesShortcut } from '../composables/shortcuts.js'
import { useTheme } from '../composables/useTheme.js'
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
    const { theme, toggleTheme } = useTheme()

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

    // 首屏抢先绘制：预览尚未首次发布（骨架屏仍在）时，先用带 Mermaid 占位块的原始 HTML
    // 撤掉骨架屏、让文本立即可读；待 mermaid SVG 就位后由 publishPreview 原子替换整份 HTML。
    // 仅在首次发布前触发（isPreviewReady 为 false），故不影响后续输入/切换/主题刷新的原子发布；
    // 也不影响定位精度——所有定位消费方走 whenPublished，仍等 SVG 就位后的最终版面。
    const paintPreview = (result) => {
        if (isPreviewReady.value) return
        html.value = result.html
        toc.value = result.toc
        isPreviewReady.value = true
    }

    const previewRenderer = createPreviewRenderSession({
        onResult: publishPreview,
        onEarlyPaint: paintPreview,
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
            onImageNotify: (message) => toast.show(message, { tone: 'warning', duration: 3000 }),
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
    // PDF 走浏览器原生打印（printDocument）：原生支持 color-mix 等现代 CSS、文字可选、体积小，
    // 取代了对 html2canvas 的依赖（其无法解析本项目的 color-mix，会渲染即抛错）。
    const exporting = {
        exportActiveFile: () => exportMarkdown(documents.activeFile.value),
        exportHtml: () => {
            if (!previewController) return
            exportHtml(previewController.scrollDOM, documents.activeFile.value?.name, { theme: theme.value })
        },
        print: () => printDocument()
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

    // —— 分享 / 导入会话 ——
    // 分享：生成 #share= 链接 + 启动时消费分享链接（见 shareSession.js）。
    const { shareActiveDocument } = createShareSession({ documents, toast, headings, waitForPreviewReady })

    // 导入：按钮 / 拖拽 / PWA 双击打开三条入口（见 importSession.js）。
    const { importFiles, openImportPicker, importDroppedFiles, setupFileHandling } = createImportSession({
        documents,
        toast,
        getEditor
    })

    // —— 生命周期 ——
    const flushOnLeave = () => documents.flush()
    const flushOnHidden = () => {
        if (document.visibilityState === 'hidden') documents.flush()
    }
    // Ctrl/Cmd + S：拦截浏览器「保存网页」，立即落盘并提示（本应用本就自动保存到本地）。
    const saveNow = async () => {
        if (documents.saveStatus.value === SAVE_STATUS.MEMORY_ONLY) {
            toast.show('浏览器未启用本地存储，内容仅保存在当前会话', { tone: 'warning', duration: 3000 })
            return
        }
        await documents.flush()
        toast.show(documents.saveStatus.value === SAVE_STATUS.FAILED ? '保存失败，请重试' : '已保存到本地', {
            tone: documents.saveStatus.value === SAVE_STATUS.FAILED ? 'error' : 'success'
        })
    }

    // —— 命令注册表 + 全局快捷键 ——
    // 命令的标题/行为见 workspace/commands.js，键位与展示文案见 composables/shortcuts.js：
    // 命令面板与此处的全局监听消费同一份注册表，tooltip 文案与按键判定同源，改动不会漏其一。
    const commands = createCommands({
        documents,
        layout,
        actions: orchestrations,
        exporting,
        theme,
        toggleTheme,
        share: shareActiveDocument,
        openImportPicker,
        saveNow
    })

    const handleKeydown = (event) => {
        const command = commands.find((cmd) => matchesShortcut(event, cmd.id))
        if (!command) return
        event.preventDefault()
        command.run()
    }

    onMounted(() => {
        headings.init()
        setupFileHandling()
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
        exporting,
        actions: orchestrations,
        commands,
        importFiles,
        openImportPicker,
        importDroppedFiles,
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

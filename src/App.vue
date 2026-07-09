<template>
    <div class="app-shell">
        <AppToolbar
            :files="files"
            :active-file-id="activeFileId"
            @select-search-result="selectSearchResult"
        />

        <main ref="mainPanelRef" class="main-panel" :style="{ '--toc-width': tocWidthStyle }">
            <MarkdownEditor
                ref="editorRef"
                v-model="markdownContent"
                :files="files"
                :active-file-id="activeFileId"
                :width="editorWidth"
                :exporting-pdf="isExportingPdf"
                @clear="clearContent"
                @scroll="handleEditorScroll"
                @select-file="selectFile"
                @create-file="createFile"
                @import-file="importFile"
                @export-file="exportActiveFile"
                @export-pdf="exportPdf"
                @delete-file="deleteFile"
            />

            <ResizeDivider :active="isResizing" @resize-start="startResize" />

            <MarkdownPreview
                ref="previewRef"
                :html="renderedHtml"
                :toc="toc"
                :active-heading-id="activeHeadingId"
                :width="previewWidth"
                :toc-width="tocWidthStyle"
                :toc-resize-active="isTocResizing"
                :stats="stats"
                :save-status="saveStatus"
                @scroll="handlePreviewScroll"
                @select-heading="selectHeading"
                @toc-resize-start="startTocResize"
            />
        </main>
    </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import AppToolbar from './components/AppToolbar.vue'
import MarkdownEditor from './components/MarkdownEditor.vue'
import MarkdownPreview from './components/MarkdownPreview.vue'
import ResizeDivider from './components/ResizeDivider.vue'
import { useMarkdownDocuments } from './composables/useMarkdownDocuments.js'
import { useMarkdownRenderer } from './composables/useMarkdownRenderer.js'
import { usePaneResize } from './composables/usePaneResize.js'
import { useScrollSync } from './composables/useScrollSync.js'
import { useTocResize } from './composables/useTocResize.js'
import { countWords } from './utils/text.js'

const mainPanelRef = ref(null)
const editorRef = ref(null)
const previewRef = ref(null)
const activeHeadingId = ref('')
const isExportingPdf = ref(false)
let hashScrollRunId = 0
let hashRetryTimer = null
const ACTIVE_HEADING_OFFSET = 4

const {
    files,
    activeFile,
    activeFileId,
    markdownContent,
    saveStatus,
    isReady,
    selectFile,
    createFile,
    importFile,
    deleteFile,
} = useMarkdownDocuments()
const { renderedHtml, toc } = useMarkdownRenderer(markdownContent)
const { editorWidth, previewWidth, isResizing, startResize } = usePaneResize(mainPanelRef)
const { tocWidthStyle, isTocResizing, startTocResize } = useTocResize()

const stats = computed(() => ({
    lines: markdownContent.value ? markdownContent.value.split('\n').length : 0,
    words: countWords(markdownContent.value),
    chars: markdownContent.value.length,
}))

const getEditorElement = () => editorRef.value?.getScrollElement()
const getPreviewElement = () => previewRef.value?.getScrollElement()

// 将编辑区与预览区滚动条同时置顶。
const scrollPanesToTop = () => {
    getEditorElement()?.scrollTo({ top: 0, behavior: 'auto' })
    getPreviewElement()?.scrollTo({ top: 0, behavior: 'auto' })
}

// 清除 URL 中的标题锚点，避免刷新或后续逻辑再次跳转到旧标题。
const clearHash = () => {
    if (!window.location.hash) return

    history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
}

const getHashHeadingId = () => {
    const hash = window.location.hash.replace(/^#/, '')
    if (!hash) return ''

    try {
        return decodeURIComponent(hash)
    } catch {
        return hash
    }
}

const setHashHeadingId = (id) => {
    const nextHash = `#${encodeURIComponent(id)}`
    if (window.location.hash === nextHash) return

    history.pushState(null, '', `${window.location.pathname}${window.location.search}${nextHash}`)
}

const getHeadingTopInPreview = (preview, element) => (
    element.getBoundingClientRect().top - preview.getBoundingClientRect().top
)

const isPreviewScrolledToEnd = (preview) => {
    const maxScrollTop = Math.max(0, preview.scrollHeight - preview.clientHeight)

    return maxScrollTop > ACTIVE_HEADING_OFFSET
        && maxScrollTop - preview.scrollTop <= ACTIVE_HEADING_OFFSET
}

const isHeadingVisibleInPreview = (preview, element) => {
    const top = getHeadingTopInPreview(preview, element)

    return top >= 0 && top <= preview.clientHeight
}

const updateActiveHeading = (preferredId = '') => {
    const preview = getPreviewElement()
    if (!preview || !toc.value.length) {
        activeHeadingId.value = ''
        return
    }

    const headings = toc.value
        .map((item) => ({
            id: item.id,
            element: preview.querySelector(`#${CSS.escape(item.id)}`),
        }))
        .filter((item) => item.element)

    if (!headings.length) {
        activeHeadingId.value = ''
        return
    }

    if (isPreviewScrolledToEnd(preview)) {
        const preferredHeading = preferredId
            ? headings.find((heading) => heading.id === preferredId)
            : null

        activeHeadingId.value = preferredHeading && isHeadingVisibleInPreview(preview, preferredHeading.element)
            ? preferredHeading.id
            : headings[headings.length - 1].id
        return
    }

    let current = headings[0]

    for (const heading of headings) {
        if (getHeadingTopInPreview(preview, heading.element) <= ACTIVE_HEADING_OFFSET) {
            current = heading
        } else {
            break
        }
    }

    activeHeadingId.value = current.id
}

const { handleEditorScroll, handlePreviewScroll, alignToSourceLine } = useScrollSync({
    getEditorElement,
    getPreviewElement,
    onPreviewScroll: updateActiveHeading,
})

const waitForAnimationFrame = () => new Promise((resolve) => {
    requestAnimationFrame(resolve)
})

const getExportFileName = (name) => {
    const safeName = String(name || '')
        .replace(/[\\/:*?"<>|]/g, '-')
        .replace(/\s+/g, ' ')
        .trim()

    if (!safeName) return 'document.md'

    return /\.(md|markdown)$/i.test(safeName) ? safeName : `${safeName}.md`
}

const exportActiveFile = () => {
    const file = activeFile.value
    if (!file) return

    const blob = new Blob([file.content || ''], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = getExportFileName(file.name)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    setTimeout(() => {
        URL.revokeObjectURL(url)
    }, 0)
}

// 一键导出 PDF：把预览内容克隆到离屏容器（保留渲染样式、解除高度与滚动限制），
// 再用 html2pdf 截图分页并直接下载，不弹浏览器打印框。html2pdf 体积较大，按需动态加载。
const exportPdf = async () => {
    if (isExportingPdf.value) return

    const source = getPreviewElement()
    const file = activeFile.value
    if (!source) return

    isExportingPdf.value = true

    const baseName = getExportFileName(file?.name || 'document.md').replace(/\.(md|markdown)$/i, '')

    // cloneNode(true) 会保留 scoped 样式所需的 data-v 属性，克隆节点仍能命中预览样式。
    const clone = source.cloneNode(true)
    clone.style.height = 'auto'
    clone.style.maxHeight = 'none'
    clone.style.overflow = 'visible'
    clone.style.width = `${source.clientWidth}px`

    const holder = document.createElement('div')
    holder.style.position = 'fixed'
    holder.style.left = '-99999px'
    holder.style.top = '0'
    holder.style.background = '#ffffff'
    holder.appendChild(clone)
    document.body.appendChild(holder)

    try {
        const { default: html2pdf } = await import('html2pdf.js')
        await html2pdf()
            .set({
                margin: [10, 10, 10, 10],
                filename: `${baseName}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
                pagebreak: { mode: ['css', 'legacy'], avoid: ['pre', 'table', 'img', 'blockquote'] },
            })
            .from(clone)
            .save()
    } catch (error) {
        console.warn('导出 PDF 失败:', error)
        alert('导出 PDF 失败，请重试。')
    } finally {
        document.body.removeChild(holder)
        isExportingPdf.value = false
    }
}

const scrollToHashHeading = async () => {
    const id = getHashHeadingId()
    if (!id) {
        updateActiveHeading()
        return
    }

    const runId = ++hashScrollRunId
    clearTimeout(hashRetryTimer)

    await nextTick()

    for (let index = 0; index < 6; index += 1) {
        await waitForAnimationFrame()
        if (runId !== hashScrollRunId) return

        const scrolled = previewRef.value?.scrollToHeading(id, { behavior: 'auto' })
        if (scrolled) {
            activeHeadingId.value = id
        }
    }

    hashRetryTimer = setTimeout(() => {
        if (runId !== hashScrollRunId) return

        const scrolled = previewRef.value?.scrollToHeading(id, { behavior: 'auto' })
        if (scrolled) {
            activeHeadingId.value = id
        }
    }, 250)
}

const selectHeading = (id) => {
    activeHeadingId.value = id
    setHashHeadingId(id)
}

const clearContent = async () => {
    if (!confirm('确定要清空所有内容吗？')) return

    markdownContent.value = ''
    await nextTick()
    editorRef.value?.focus()
}

const selectSearchResult = async ({ fileId, lineNumber }) => {
    selectFile(fileId)
    await nextTick()

    if (lineNumber) {
        // 编辑区只做选中高亮，两侧滚动统一交给 alignToSourceLine，避免多个滚动源竞争。
        editorRef.value?.focusLine(lineNumber, { scroll: false })
        alignToSourceLine(lineNumber)
    } else {
        editorRef.value?.focus()
    }
}

const handleKeydown = (event) => {
    if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'c') {
        event.preventDefault()
        clearContent()
    }
}

watch(activeFileId, async () => {
    // 首次异步加载(hydrate)会把 activeId 从空变为初始值，此时不应置顶或清除 hash。
    if (!isReady.value) return

    activeHeadingId.value = ''

    // 渲染前同步置顶：若随后有行内定位（搜索跳转），它在 nextTick 后执行会自然覆盖这里。
    scrollPanesToTop()
    clearHash()

    await nextTick()
    updateActiveHeading()
})

// 数据就绪后再处理初始 hash 直达与首屏高亮（此时文档已从 IndexedDB 加载完成）。
watch(isReady, async (ready) => {
    if (!ready) return

    await nextTick()
    scrollToHashHeading()
})

onMounted(() => {
    editorRef.value?.focus()
    document.addEventListener('keydown', handleKeydown)
    window.addEventListener('hashchange', scrollToHashHeading)
})

onBeforeUnmount(() => {
    document.removeEventListener('keydown', handleKeydown)
    window.removeEventListener('hashchange', scrollToHashHeading)
    clearTimeout(hashRetryTimer)
})
</script>

<style scoped>
.app-shell {
    display: flex;
    height: 100vh;
    overflow: hidden;
    background: linear-gradient(180deg, #f8fafc 0%, var(--color-bg) 100%);
    flex-direction: column;
}

.main-panel {
    position: relative;
    display: flex;
    flex: 1;
    min-height: 0;
    margin: 12px;
    overflow: hidden;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: var(--color-surface);
    box-shadow: var(--shadow-panel);
    --toc-width: 220px;
}

@media (max-width: 1120px) {
    .main-panel {
        --toc-width: 180px;
    }
}

@media (max-width: 900px) {
    .main-panel {
        --toc-width: 0px;
    }
}

@media (max-width: 768px) {
    .main-panel {
        flex-direction: column;
        margin: 8px;
    }
}
</style>

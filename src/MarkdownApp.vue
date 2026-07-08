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
                @clear="clearContent"
                @scroll="handleEditorScroll"
                @select-file="selectFile"
                @create-file="createFile"
                @import-file="importFile"
                @export-file="exportActiveFile"
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
import { useMarkdownDocuments } from './composables/useMarkdownDocuments'
import { useMarkdownRenderer } from './composables/useMarkdownRenderer'
import { usePaneResize } from './composables/usePaneResize'
import { useScrollSync } from './composables/useScrollSync'
import { useTocResize } from './composables/useTocResize'
import { countWords } from './utils/text'

const mainPanelRef = ref(null)
const editorRef = ref(null)
const previewRef = ref(null)
const activeHeadingId = ref('')
let hashScrollRunId = 0
let hashRetryTimer = null
let selectedHeadingLockTimer = null
const selectedHeadingLockId = ref('')
const ACTIVE_HEADING_OFFSET = 4

const {
    files,
    activeFile,
    activeFileId,
    markdownContent,
    saveStatus,
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
    if (selectedHeadingLockId.value) {
        activeHeadingId.value = selectedHeadingLockId.value
        return
    }

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

const { handleEditorScroll, handlePreviewScroll } = useScrollSync({
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
    clearTimeout(selectedHeadingLockTimer)
    selectedHeadingLockId.value = id
    activeHeadingId.value = id
    setHashHeadingId(id)

    selectedHeadingLockTimer = setTimeout(() => {
        selectedHeadingLockId.value = ''
        updateActiveHeading(id)
    }, 700)
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
        editorRef.value?.focusLine(lineNumber)
        previewRef.value?.scrollToSourceLine(lineNumber)
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

watch(activeFileId, () => {
    activeHeadingId.value = ''
    selectedHeadingLockId.value = ''
    scrollToHashHeading()
})

onMounted(() => {
    editorRef.value?.focus()
    document.addEventListener('keydown', handleKeydown)
    window.addEventListener('hashchange', scrollToHashHeading)
    scrollToHashHeading()
})

onBeforeUnmount(() => {
    document.removeEventListener('keydown', handleKeydown)
    window.removeEventListener('hashchange', scrollToHashHeading)
    clearTimeout(hashRetryTimer)
    clearTimeout(selectedHeadingLockTimer)
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

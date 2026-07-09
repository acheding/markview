<template>
    <div class="app-shell">
        <AppToolbar :files="files" :active-file-id="activeFileId" @select-search-result="selectSearchResult" />

        <main
            ref="mainPanelRef"
            class="main-panel"
            :class="{ 'is-editor-collapsed': isEditorCollapsed, 'is-resizing': isResizing }"
            :style="{ '--toc-width': tocWidthStyle }"
        >
            <ContentViewSkeleton v-if="!isReady" />

            <template v-else>
                <MarkdownEditor
                    ref="editorRef"
                    v-model="markdownContent"
                    :files="files"
                    :active-file-id="activeFileId"
                    :width="isEditorCollapsed ? 0 : editorWidth"
                    :collapsed="isEditorCollapsed"
                    :exporting-pdf="isExportingPdf"
                    @clear="clearContent"
                    @scroll="handleEditorScroll"
                    @select-file="selectFile"
                    @create-file="createFile"
                    @import-file="importFile"
                    @export-file="exportActiveFile"
                    @export-pdf="exportPdf"
                    @delete-file="deleteFile"
                    @collapse-editor="setEditorCollapsed(true)"
                />

                <ResizeDivider :active="isResizing" :collapsed="isEditorCollapsed" @resize-start="startResize" />

                <MarkdownPreview
                    ref="previewRef"
                    :html="renderedHtml"
                    :toc="toc"
                    :active-heading-id="activeHeadingId"
                    :width="isEditorCollapsed ? '100%' : previewWidth"
                    :toc-width="tocWidthStyle"
                    :toc-resize-active="isTocResizing"
                    :stats="stats"
                    :save-status="saveStatus"
                    :editor-collapsed="isEditorCollapsed"
                    :files="files"
                    :active-file-id="activeFileId"
                    :exporting-pdf="isExportingPdf"
                    @scroll="handlePreviewScroll"
                    @select-heading="selectHeading"
                    @toc-resize-start="startTocResize"
                    @expand-editor="setEditorCollapsed(false)"
                    @import-file="importFile"
                    @export-file="exportActiveFile"
                    @export-pdf="exportPdf"
                    @select-file="selectFile"
                    @delete-file="deleteFile"
                />
            </template>
        </main>
    </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import AppToolbar from './components/AppToolbar.vue'
import ContentViewSkeleton from './components/ContentViewSkeleton.vue'
import MarkdownEditor from './components/MarkdownEditor.vue'
import MarkdownPreview from './components/MarkdownPreview.vue'
import ResizeDivider from './components/ResizeDivider.vue'
import { useDocumentExport } from './composables/useDocumentExport.js'
import { useHeadingNavigation } from './composables/useHeadingNavigation.js'
import { useMarkdownDocuments } from './composables/useMarkdownDocuments.js'
import { useMarkdownRenderer } from './composables/useMarkdownRenderer.js'
import { useLocalStoragePreference } from './composables/useLocalStoragePreference.js'
import { usePaneResize } from './composables/usePaneResize.js'
import { useScrollSync } from './composables/useScrollSync.js'
import { useTocResize } from './composables/useTocResize.js'
import { countWords } from './utils/text.js'

const EDITOR_COLLAPSED_STORAGE_KEY = 'markview:editor-collapsed'

const mainPanelRef = ref(null)
const editorRef = ref(null)
const previewRef = ref(null)
const isEditorCollapsed = useLocalStoragePreference(EDITOR_COLLAPSED_STORAGE_KEY, false)

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
    deleteFile
} = useMarkdownDocuments()
const { renderedHtml, toc } = useMarkdownRenderer(markdownContent)
const { editorWidth, previewWidth, isResizing, startResize } = usePaneResize(mainPanelRef)
const { tocWidthStyle, isTocResizing, startTocResize } = useTocResize()

const stats = computed(() => ({
    lines: markdownContent.value ? markdownContent.value.split('\n').length : 0,
    words: countWords(markdownContent.value),
    chars: markdownContent.value.length
}))

const getEditorElement = () => editorRef.value?.getScrollElement()
const getPreviewElement = () => previewRef.value?.getScrollElement()
const { isExportingPdf, exportActiveFile, exportPdf } = useDocumentExport({
    activeFile,
    getPreviewElement
})
const { activeHeadingId, clearHash, scrollToHashHeading, selectHeading, updateActiveHeading } = useHeadingNavigation({
    toc,
    getPreviewElement,
    getPreviewComponent: () => previewRef.value
})

// 将编辑区与预览区滚动条同时置顶。
const scrollPanesToTop = () => {
    getEditorElement()?.scrollTo({ top: 0, behavior: 'auto' })
    getPreviewElement()?.scrollTo({ top: 0, behavior: 'auto' })
}

const setEditorCollapsed = async (collapsed) => {
    isEditorCollapsed.value = collapsed
    await nextTick()

    if (!collapsed) {
        // preventScroll 避免 focus 导致浏览器自动滚动到光标位置
        const textarea = editorRef.value?.getScrollElement()
        textarea?.focus({ preventScroll: true })
    }

    updateActiveHeading()
}

const { handleEditorScroll, handlePreviewScroll, alignToSourceLine } = useScrollSync({
    getEditorElement,
    getPreviewElement,
    onPreviewScroll: updateActiveHeading
})

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
        if (isEditorCollapsed.value) {
            previewRef.value?.scrollToSourceLine(lineNumber)
            updateActiveHeading()
        } else {
            editorRef.value?.focusLine(lineNumber, { scroll: false })
            alignToSourceLine(lineNumber)
        }
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
    if (!isEditorCollapsed.value) {
        editorRef.value?.focus()
    }
    document.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
    document.removeEventListener('keydown', handleKeydown)
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

/* 非拖拽时启用面板过渡（折叠/展开动画） */
/* 桌面端（横向）：宽度过渡 */
@media (min-width: 769px) {
    .main-panel:not(.is-resizing) :deep(.editor-panel),
    .main-panel:not(.is-resizing) :deep(.preview-panel) {
        transition:
            width 0.28s ease,
            min-width 0.28s ease;
    }

    .main-panel:not(.is-resizing) :deep(.divider) {
        transition: width 0.28s ease;
    }
}

/* 移动端（纵向）：高度过渡 */
@media (max-width: 768px) {
    .main-panel:not(.is-resizing) :deep(.editor-panel),
    .main-panel:not(.is-resizing) :deep(.preview-panel) {
        transition:
            height 0.28s ease,
            min-height 0.28s ease;
    }
}

.main-panel.is-editor-collapsed .preview-panel {
    min-width: 0;
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

    .main-panel.is-editor-collapsed .preview-panel {
        height: 100%;
    }
}
</style>

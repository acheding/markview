<template>
    <section class="preview-panel" :style="{ width: normalizedWidth }">
        <div class="panel-header">
            <!-- 折叠态：文件切换 + 操作按钮 -->
            <div v-if="editorCollapsed" class="preview-collapsed-toolbar">
                <PanelToolbar
                    context="preview"
                    :files="files"
                    :active-file-id="activeFileId"
                    :exporting-pdf="exportingPdf"
                    @select-file="$emit('select-file', $event)"
                    @delete-file="$emit('delete-file', $event)"
                    @import-file="$emit('import-file', $event)"
                    @export-file="$emit('export-file')"
                    @export-pdf="$emit('export-pdf')"
                    @expand-editor="$emit('expand-editor')"
                />
            </div>

            <div v-if="!editorCollapsed" class="preview-stats" aria-label="文档统计">
                <span class="preview-stat"
                    >行数 <strong>{{ stats.lines }}</strong></span
                >
                <span class="preview-stat"
                    >字数 <strong>{{ stats.words }}</strong></span
                >
                <span class="preview-stat"
                    >字符 <strong>{{ stats.chars }}</strong></span
                >
            </div>

            <span v-if="!editorCollapsed" class="preview-save-status">
                {{ saveStatus }}
            </span>
        </div>

        <div class="preview-layout" :style="{ '--preview-toc-width': tocWidth }">
            <div
                ref="contentRef"
                class="preview-content"
                tabindex="-1"
                aria-label="Markdown 预览"
                :style="{ '--search-highlight-duration': `${SEARCH_HIGHLIGHT_DURATION_MS}ms` }"
                v-html="html"
                @click="handlePreviewClick"
                @scroll="handleContentScroll"
            />

            <button
                v-show="isBackTopVisible"
                class="preview-back-top"
                type="button"
                title="回到顶部"
                aria-label="回到顶部"
                @click="scrollToTop"
            >
                <span
                    class="preview-back-top__icon"
                    :style="{ '--icon-url': `url(${backToTopIcon})` }"
                    aria-hidden="true"
                />
            </button>

            <ResizeDivider
                class="toc-divider"
                :active="tocResizeActive"
                @resize-start="$emit('toc-resize-start', $event)"
            />

            <TableOfContents :items="toc" :active-id="activeHeadingId" :width="tocWidth" @select="handleTocSelect" />
        </div>
    </section>
</template>

<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import backToTopIcon from '../assets/back-to-top.svg'
import PanelToolbar from './PanelToolbar.vue'
import ResizeDivider from './ResizeDivider.vue'
import TableOfContents from './TableOfContents.vue'

const SEARCH_HIGHLIGHT_DURATION_MS = 2400

const props = defineProps({
    html: {
        type: String,
        required: true
    },
    toc: {
        type: Array,
        default: () => []
    },
    activeHeadingId: {
        type: String,
        default: ''
    },
    width: {
        type: [Number, String],
        required: true
    },
    tocWidth: {
        type: String,
        default: '220px'
    },
    tocResizeActive: {
        type: Boolean,
        default: false
    },
    stats: {
        type: Object,
        required: true
    },
    saveStatus: {
        type: String,
        required: true
    },
    editorCollapsed: {
        type: Boolean,
        default: false
    },
    files: {
        type: Array,
        default: () => []
    },
    activeFileId: {
        type: String,
        default: ''
    },
    exportingPdf: {
        type: Boolean,
        default: false
    }
})

const emit = defineEmits([
    'scroll',
    'select-heading',
    'toc-resize-start',
    'expand-editor',
    'import-file',
    'export-file',
    'export-pdf',
    'select-file',
    'delete-file'
])
const contentRef = ref(null)
const isBackTopVisible = ref(false)
const normalizedWidth = computed(() => (typeof props.width === 'number' ? `${props.width}%` : props.width))
let searchHighlightTimer = null

const clearSearchHighlight = () => {
    clearTimeout(searchHighlightTimer)
    searchHighlightTimer = null

    const content = contentRef.value
    if (!content) return

    content.querySelectorAll('.preview-search-highlight').forEach((mark) => {
        const parent = mark.parentNode
        mark.replaceWith(document.createTextNode(mark.textContent || ''))
        parent?.normalize()
    })
    content.querySelectorAll('.is-search-highlight').forEach((element) => {
        element.classList.remove('is-search-highlight')
    })
}

const getSourceElement = (lineNumber) => {
    const content = contentRef.value
    const line = Number(lineNumber)
    if (!content || !Number.isFinite(line)) return null

    const sourceElements = Array.from(content.querySelectorAll('[data-source-line]'))
        .map((element) => ({
            element,
            line: Number(element.dataset.sourceLine)
        }))
        .filter((item) => Number.isFinite(item.line))

    if (!sourceElements.length) return null

    let target = sourceElements[0].element

    for (const item of sourceElements) {
        if (item.line <= line) {
            target = item.element
        } else {
            break
        }
    }

    return target
}

const highlightText = (target, query) => {
    const searchQuery = String(query).trim()
    if (!searchQuery) return false

    const textNodes = []
    const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT)
    let text = ''
    let node = walker.nextNode()

    while (node) {
        if (!node.parentElement?.closest('.heading-anchor')) {
            textNodes.push({ node, start: text.length, end: text.length + node.data.length })
            text += node.data
        }
        node = walker.nextNode()
    }

    const matchStart = text.toLowerCase().indexOf(searchQuery.toLowerCase())
    if (matchStart < 0) return false

    const matchEnd = matchStart + searchQuery.length
    textNodes
        .filter((item) => item.start < matchEnd && item.end > matchStart)
        .reverse()
        .forEach((item) => {
            const range = document.createRange()
            range.setStart(item.node, Math.max(0, matchStart - item.start))
            range.setEnd(item.node, Math.min(item.node.data.length, matchEnd - item.start))

            const mark = document.createElement('mark')
            mark.className = 'preview-search-highlight'
            range.surroundContents(mark)
        })

    return true
}

const highlightSourceLine = (lineNumber, query) => {
    clearSearchHighlight()

    const target = getSourceElement(lineNumber)
    if (!target) return false

    if (!highlightText(target, query)) {
        target.classList.add('is-search-highlight')
    }

    searchHighlightTimer = setTimeout(clearSearchHighlight, SEARCH_HIGHLIGHT_DURATION_MS)

    return true
}

const scrollToElement = (target, options = {}) => {
    const content = contentRef.value
    if (!content || !target) return false

    const contentRect = content.getBoundingClientRect()
    const targetRect = target.getBoundingClientRect()
    const viewportOffset = content.clientHeight * (options.viewportRatio || 0)
    const top = content.scrollTop + targetRect.top - contentRect.top - viewportOffset - (options.offset || 0)

    content.scrollTo({
        top,
        behavior: options.behavior || 'smooth'
    })

    return true
}

const scrollToHeading = (id, options = {}) => {
    const content = contentRef.value
    const target = content?.querySelector(`#${CSS.escape(id)}`)

    return scrollToElement(target, options)
}

const scrollToSourceLine = (lineNumber, options = {}) => {
    const target = getSourceElement(lineNumber)

    return scrollToElement(target, options)
}

const handleTocSelect = (id) => {
    scrollToHeading(id)
    emit('select-heading', id)
}

const handlePreviewClick = async (event) => {
    const anchor = event.target.closest?.('.heading-anchor')
    if (!anchor) return

    const id = anchor.getAttribute('href')?.replace(/^#/, '')
    if (!id) return

    event.preventDefault()

    // 复制带 hash 的完整链接到剪贴板
    try {
        const url = new URL(window.location)
        url.hash = id
        await navigator.clipboard.writeText(url.toString())

        // 视觉反馈：锚点短暂显示 ✓
        const textNode = anchor.childNodes[0]
        const originalText = textNode?.textContent
        if (textNode) textNode.textContent = '✓'
        setTimeout(() => {
            if (textNode) textNode.textContent = originalText
        }, 1000)
    } catch {
        // 降级：仅更新地址栏 hash
        window.location.hash = id
    }

    scrollToHeading(id)
    emit('select-heading', id)
}

const handleContentScroll = () => {
    isBackTopVisible.value = (contentRef.value?.scrollTop || 0) > 240
    emit('scroll')
}

const scrollToTop = () => {
    contentRef.value?.scrollTo({
        top: 0,
        behavior: 'smooth'
    })
}

onBeforeUnmount(clearSearchHighlight)

defineExpose({
    clearSearchHighlight,
    focus: () => contentRef.value?.focus({ preventScroll: true }),
    getScrollElement: () => contentRef.value,
    highlightSourceLine,
    scrollToHeading,
    scrollToSourceLine
})
</script>

<style scoped>
.preview-panel {
    display: flex;
    min-width: 22%;
    overflow: hidden;
    background: var(--color-surface);
    flex-direction: column;
}

.preview-layout {
    position: relative;
    display: flex;
    flex: 1;
    min-height: 0;
}

.preview-content {
    flex: 1;
    min-width: 0;
    min-height: 0;
    padding: 20px 36px;
    overflow-y: auto;
    background: var(--color-surface);
    color: var(--color-text);
    font-size: 15px;
    line-height: 1.8;
    scroll-behavior: auto;
    contain: layout;
}

.preview-content :deep(.preview-search-highlight) {
    border-radius: 3px;
    background: var(--color-search-highlight);
    color: var(--color-search-highlight-text);
    animation: preview-search-highlight-fade var(--search-highlight-duration) ease forwards;
}

.preview-content :deep(.is-search-highlight) {
    outline: 3px solid var(--color-search-highlight);
    outline-offset: 3px;
    animation: preview-search-outline-fade var(--search-highlight-duration) ease forwards;
}

@keyframes preview-search-highlight-fade {
    0%,
    72% {
        background: var(--color-search-highlight);
        color: var(--color-search-highlight-text);
    }

    100% {
        background: transparent;
        color: inherit;
    }
}

@keyframes preview-search-outline-fade {
    0%,
    72% {
        outline-color: var(--color-search-highlight);
    }

    100% {
        outline-color: transparent;
    }
}

.preview-collapsed-toolbar {
    flex: 1;
    min-width: 0;
}

.preview-stats {
    display: inline-flex;
    align-items: center;
    gap: 14px;
    min-width: 0;
    overflow-x: auto;
    color: var(--color-muted);
    font-size: 13px;
}

.preview-stat {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    white-space: nowrap;
}

.preview-stat strong {
    min-width: 24px;
    color: var(--color-text);
    font-weight: 650;
    text-align: center;
}

.preview-save-status {
    flex-shrink: 0;
    color: var(--color-subtle);
    font-size: 12px;
    font-weight: 600;
    line-height: 1.2;
    white-space: nowrap;
}

.preview-back-top {
    position: absolute;
    right: calc(var(--preview-toc-width) + 18px);
    bottom: 18px;
    z-index: 12;
    display: inline-grid;
    place-items: center;
    width: 34px;
    height: 34px;
    padding: 0;
    border: 1px solid color-mix(in srgb, var(--color-accent) 26%, #ffffff);
    border-radius: 8px;
    background: rgb(255 255 255 / 92%);
    color: var(--color-accent-strong);
    cursor: pointer;
    box-shadow: 0 10px 24px rgb(15 23 42 / 14%);
    backdrop-filter: blur(8px);
    transition:
        transform 0.15s ease,
        background 0.15s ease,
        border-color 0.15s ease,
        color 0.15s ease,
        box-shadow 0.15s ease;
}

.preview-back-top:hover {
    border-color: color-mix(in srgb, var(--color-accent) 44%, #ffffff);
    background: var(--color-surface-active);
    color: var(--color-accent);
    box-shadow: 0 14px 28px rgb(15 118 110 / 16%);
    transform: translateY(-1px);
}

.preview-back-top:active {
    transform: translateY(0);
}

.preview-back-top__icon {
    width: 17px;
    height: 17px;
    background: currentColor;
    mask: var(--icon-url) center / contain no-repeat;
    -webkit-mask: var(--icon-url) center / contain no-repeat;
}

.preview-content :deep(h1) {
    margin: 18px 0 14px;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--color-border);
    color: #111827;
    font-size: 28px;
    font-weight: 760;
    line-height: 1.25;
}

.preview-content :deep(h2) {
    margin: 20px 0 10px;
    padding-bottom: 7px;
    border-bottom: 1px solid var(--color-border-soft);
    color: #1f2937;
    font-size: 22px;
    font-weight: 720;
    line-height: 1.35;
}

.preview-content :deep(h3) {
    margin: 16px 0 8px;
    color: #1f2937;
    font-size: 18px;
    font-weight: 700;
}

.preview-content :deep(h4),
.preview-content :deep(h5),
.preview-content :deep(h6) {
    margin: 14px 0 6px;
    color: #1f2937;
    font-weight: 680;
}

.preview-content :deep(.heading-anchor) {
    float: left;
    margin-left: -0.8em;
    color: var(--color-accent);
    text-decoration: none;
    opacity: 0;
    transition: opacity 0.15s ease;
}

.preview-content :deep(h1:hover .heading-anchor),
.preview-content :deep(h2:hover .heading-anchor),
.preview-content :deep(h3:hover .heading-anchor),
.preview-content :deep(h4:hover .heading-anchor),
.preview-content :deep(h5:hover .heading-anchor),
.preview-content :deep(h6:hover .heading-anchor) {
    opacity: 1;
}

.preview-content :deep(p) {
    margin: 10px 0;
}

.preview-content :deep(ul),
.preview-content :deep(ol) {
    margin: 8px 0;
    padding-left: 28px;
}

.preview-content :deep(li) {
    margin: 3px 0;
}

.preview-content :deep(blockquote) {
    margin: 12px 0;
    padding: 10px 16px;
    border-left: 3px solid var(--color-accent);
    border-radius: 0 8px 8px 0;
    background: #f0fdfa;
    color: #475569;
}

.preview-content :deep(code) {
    padding: 2px 6px;
    border-radius: 4px;
    background: #eef2f7;
    color: #a31515;
    font-family: 'SF Mono', 'JetBrains Mono', 'Fira Code', Consolas, monospace;
    font-size: 0.9em;
}

.preview-content :deep(pre) {
    margin: 12px 0;
    padding: 0;
    overflow-x: auto;
    border: 1px solid var(--color-border-soft);
    border-radius: 8px;
    background: #f6f8fa;
    color: #24292f;
    font-size: 13px;
    line-height: 1.6;
}

.preview-content :deep(pre code) {
    display: block;
    padding: 14px 18px;
    border-radius: 0;
    background: transparent;
    color: inherit;
    font-size: inherit;
}

.preview-content :deep(.hljs-comment),
.preview-content :deep(.hljs-quote) {
    color: #008000;
}

.preview-content :deep(.hljs-keyword),
.preview-content :deep(.hljs-selector-tag),
.preview-content :deep(.hljs-subst) {
    color: #0000ff;
}

.preview-content :deep(.hljs-string),
.preview-content :deep(.hljs-attr),
.preview-content :deep(.hljs-symbol),
.preview-content :deep(.hljs-bullet) {
    color: #a31515;
}

.preview-content :deep(.hljs-title),
.preview-content :deep(.hljs-section),
.preview-content :deep(.hljs-selector-id) {
    color: #795e26;
}

.preview-content :deep(.hljs-number),
.preview-content :deep(.hljs-literal),
.preview-content :deep(.hljs-variable),
.preview-content :deep(.hljs-template-variable) {
    color: #098658;
}

.preview-content :deep(.hljs-type),
.preview-content :deep(.hljs-built_in),
.preview-content :deep(.hljs-class .hljs-title) {
    color: #267f99;
}

.preview-content :deep(.hljs-meta),
.preview-content :deep(.hljs-doctag) {
    color: #af00db;
}

.preview-content :deep(table) {
    width: 100%;
    margin: 12px 0;
    border-collapse: collapse;
    font-size: 14px;
}

.preview-content :deep(th),
.preview-content :deep(td) {
    padding: 8px 14px;
    border: 1px solid var(--color-border);
    text-align: left;
}

.preview-content :deep(th) {
    background: #f8fafc;
    font-weight: 650;
}

.preview-content :deep(tr:nth-child(even)) {
    background: #fbfdff;
}

.preview-content :deep(a) {
    color: var(--color-blue);
    text-decoration: none;
}

.preview-content :deep(a:hover) {
    text-decoration: underline;
}

.preview-content :deep(img) {
    max-width: 100%;
    height: auto;
    margin: 8px 0;
    border-radius: 8px;
}

.preview-content :deep(hr) {
    margin: 20px 0;
    border: none;
    border-top: 1px solid var(--color-border);
}

.preview-content :deep(del) {
    color: var(--color-subtle);
}

.preview-content :deep(.empty-hint) {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 40px;
    color: var(--color-subtle);
    font-size: 16px;
    text-align: center;
}

.preview-content :deep(.error-hint) {
    padding: 16px 20px;
    border-left: 4px solid var(--color-danger);
    border-radius: 8px;
    background: var(--color-danger-soft);
    color: var(--color-danger);
}

@media (max-width: 768px) {
    .preview-panel {
        width: 100% !important;
        height: 52%;
    }

    .preview-content {
        padding: 12px 20px;
        font-size: 14px;
    }

    .preview-back-top {
        right: 14px;
        bottom: 14px;
    }
}

@media (max-width: 900px) {
    .toc-divider {
        display: none;
    }

    .preview-back-top {
        right: 16px;
    }
}
</style>

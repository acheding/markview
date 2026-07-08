<template>
    <section class="preview-panel" :style="{ width: normalizedWidth }">
        <div class="panel-header">
            <div class="preview-stats" aria-label="文档统计">
                <span class="preview-stat">行数 <strong>{{ stats.lines }}</strong></span>
                <span class="preview-stat">字数 <strong>{{ stats.words }}</strong></span>
                <span class="preview-stat">字符 <strong>{{ stats.chars }}</strong></span>
            </div>
            <span class="preview-save-status" :class="{ 'is-saving': saveStatus === '保存中' }">{{ saveStatus }}</span>
        </div>

        <div class="preview-layout">
            <div
                ref="contentRef"
                class="preview-content"
                v-html="html"
                @click="handlePreviewClick"
                @scroll="$emit('scroll')"
            />

            <ResizeDivider
                class="toc-divider"
                :active="tocResizeActive"
                @resize-start="$emit('toc-resize-start', $event)"
            />

            <TableOfContents
                :items="toc"
                :active-id="activeHeadingId"
                :width="tocWidth"
                @select="handleTocSelect"
            />
        </div>
    </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import ResizeDivider from './ResizeDivider.vue'
import TableOfContents from './TableOfContents.vue'

const props = defineProps({
    html: {
        type: String,
        required: true,
    },
    toc: {
        type: Array,
        default: () => [],
    },
    activeHeadingId: {
        type: String,
        default: '',
    },
    width: {
        type: [Number, String],
        required: true,
    },
    tocWidth: {
        type: String,
        default: '220px',
    },
    tocResizeActive: {
        type: Boolean,
        default: false,
    },
    stats: {
        type: Object,
        required: true,
    },
    saveStatus: {
        type: String,
        required: true,
    },
})

const emit = defineEmits(['scroll', 'select-heading', 'toc-resize-start'])
const contentRef = ref(null)
const normalizedWidth = computed(() => (
    typeof props.width === 'number' ? `${props.width}%` : props.width
))

const scrollToHeading = (id, options = {}) => {
    const content = contentRef.value
    const target = content?.querySelector(`#${CSS.escape(id)}`)
    if (!content || !target) return false

    const contentRect = content.getBoundingClientRect()
    const targetRect = target.getBoundingClientRect()
    const top = content.scrollTop + targetRect.top - contentRect.top - (options.offset || 0)

    content.scrollTo({
        top,
        behavior: options.behavior || 'smooth',
    })

    return true
}

const handleTocSelect = (id) => {
    scrollToHeading(id)
    emit('select-heading', id)
}

const handlePreviewClick = (event) => {
    const anchor = event.target.closest?.('.heading-anchor')
    if (!anchor) return

    const id = anchor.getAttribute('href')?.replace(/^#/, '')
    if (!id) return

    event.preventDefault()
    scrollToHeading(id)
    emit('select-heading', id)
}

defineExpose({
    getScrollElement: () => contentRef.value,
    scrollToHeading,
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
    display: flex;
    flex: 1;
    min-height: 0;
}

.preview-content {
    flex: 1;
    min-width: 0;
    min-height: 0;
    padding: 20px 28px;
    overflow-y: auto;
    background: var(--color-surface);
    color: var(--color-text);
    font-size: 15px;
    line-height: 1.8;
    scroll-behavior: auto;
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
    padding: 3px 10px;
    border: 1px solid color-mix(in srgb, var(--color-accent) 28%, #ffffff);
    border-radius: 999px;
    background: var(--color-surface-active);
    color: var(--color-accent-strong);
    font-size: 12px;
    font-weight: 650;
}

.preview-save-status.is-saving {
    border-color: color-mix(in srgb, var(--color-blue) 24%, #ffffff);
    background: #eff6ff;
    color: var(--color-blue);
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
    margin-right: 8px;
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
    font-family: "SF Mono", "JetBrains Mono", "Fira Code", Consolas, monospace;
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
        padding: 12px 14px;
        font-size: 14px;
    }
}

@media (max-width: 900px) {
    .toc-divider {
        display: none;
    }
}
</style>

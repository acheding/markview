<template>
    <section class="preview-panel" :style="{ width: normalizedWidth }">
        <div class="panel-header">
            <!-- 折叠态：文件切换 + 操作按钮 -->
            <div v-if="layout.isEditorCollapsed.value" class="preview-collapsed-toolbar">
                <PanelToolbar context="preview" />
            </div>

            <template v-else>
                <div class="preview-stats" aria-label="文档统计">
                    <span class="preview-stat"
                        >行数 <strong>{{ documents.stats.value.lines }}</strong></span
                    >
                    <span class="preview-stat"
                        >字数 <strong>{{ documents.stats.value.words }}</strong></span
                    >
                    <span class="preview-stat"
                        >字符 <strong>{{ documents.stats.value.chars }}</strong></span
                    >
                </div>

                <span class="preview-save-status">{{ documents.saveStatusLabel.value }}</span>
            </template>
        </div>

        <div class="preview-layout" :style="{ '--preview-toc-width': layout.tocWidthStyle.value }">
            <div
                ref="contentRef"
                class="preview-content markdown-body"
                tabindex="-1"
                aria-label="Markdown 预览"
                v-html="html"
                @pointerdown="search.clearActiveMatch()"
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
                :active="layout.isTocResizing.value"
                @resize-start="layout.startTocResize"
            />

            <TableOfContents
                :items="toc"
                :active-id="headings.activeHeadingId.value"
                :width="layout.tocWidthStyle.value"
                @select="handleTocSelect"
            />
        </div>
    </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import backToTopIcon from '../assets/back-to-top.svg'
import { useWorkspace } from '../workspace/workspaceKey.js'
import PanelToolbar from './PanelToolbar.vue'
import ResizeDivider from './ResizeDivider.vue'
import TableOfContents from './TableOfContents.vue'

const workspace = useWorkspace()
const { documents, search, layout, headings, html, toc } = workspace

const contentRef = ref(null)
const isBackTopVisible = ref(false)

const normalizedWidth = computed(() => (layout.isEditorCollapsed.value ? '100%' : layout.previewWidth.value))

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

        const textNode = anchor.childNodes[0]
        const originalText = textNode?.textContent
        if (textNode) textNode.textContent = '✓'
        setTimeout(() => {
            if (textNode) textNode.textContent = originalText
        }, 1000)
    } catch {
        window.location.hash = id
    }

    workspace.beginPreviewNavigation()
    workspace.getPreview()?.scrollToHeading(id)
    headings.beginNavigation(id)
}

const handleContentScroll = () => {
    isBackTopVisible.value = (contentRef.value?.scrollTop || 0) > 240
    workspace.handlePreviewScroll()
}

const scrollToTop = () => {
    workspace.beginPreviewNavigation()
    contentRef.value?.scrollTo({ top: 0, behavior: 'smooth' })
}

const handleTocSelect = (id) => {
    workspace.beginPreviewNavigation()
    workspace.getPreview()?.scrollToHeading(id)
    headings.beginNavigation(id)
}

onMounted(() => {
    workspace.attachPreview(contentRef.value)
})

onBeforeUnmount(() => {
    workspace.detachPreview()
})
</script>

<style scoped>
.preview-panel {
    display: flex;
    min-width: 34%;
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
    scroll-behavior: auto;
    contain: layout;
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
    font-size: var(--font-size-md);
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
    font-size: var(--font-size-sm);
    font-weight: 600;
    line-height: 1.2;
    white-space: nowrap;
}

.preview-back-top {
    position: absolute;
    right: calc(var(--preview-toc-width) + 18px);
    bottom: 18px;
    z-index: var(--z-float);
    display: inline-grid;
    place-items: center;
    width: 34px;
    height: 34px;
    padding: 0;
    border: 1px solid color-mix(in srgb, var(--color-accent) 26%, #ffffff);
    border-radius: var(--radius-lg);
    background: var(--color-surface-glass);
    color: var(--color-accent-strong);
    cursor: pointer;
    box-shadow: 0 10px 24px rgb(15 23 42 / 14%);
    backdrop-filter: blur(8px);
    transition:
        transform var(--duration-fast) ease,
        background var(--duration-fast) ease,
        border-color var(--duration-fast) ease,
        color var(--duration-fast) ease,
        box-shadow var(--duration-fast) ease;
}

.preview-back-top:hover {
    border-color: color-mix(in srgb, var(--color-accent) 44%, #ffffff);
    background: var(--color-surface-active);
    color: var(--color-accent);
    box-shadow: 0 14px 28px rgb(var(--color-accent-channel) / 16%);
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

@media (max-width: 768px) {
    .preview-panel {
        width: 100% !important;
        height: 52%;
    }

    .preview-content {
        padding: 12px 20px;
        font-size: var(--font-size-base);
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

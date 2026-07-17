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
                    <span v-if="documents.stats.value.images" class="preview-stat"
                        >图片 <strong>{{ documents.stats.value.images }}</strong></span
                    >
                </div>

                <Transition name="save-status" mode="out-in">
                    <!-- 需用户处置的状态（待授权 / 文件丢失）标签升级为按钮：
                         待授权点击在用户手势内重新请求权限；丢失点击唤起处置弹窗（另存 / 取消关联） -->
                    <button
                        v-if="statusAction"
                        :key="statusAction"
                        class="preview-save-status preview-save-status--action"
                        type="button"
                        @click="runStatusAction"
                    >
                        {{ statusLabel }}
                    </button>
                    <span v-else :key="statusLabel" class="preview-save-status">
                        <span v-if="isSaving" class="preview-save-status__dot" aria-hidden="true" />
                        {{ statusLabel }}
                    </span>
                </Transition>
            </template>
        </div>

        <div
            :ref="(el) => (layout.previewLayoutRef.value = el)"
            class="preview-layout"
            :style="{ '--preview-toc-width': layout.tocWidthStyle.value }"
        >
            <!-- 阅读进度条：随预览滚动从左向右填充，用 scaleX 走 GPU 合成，不触发重排 -->
            <div v-show="hasOverflow" class="reading-progress" aria-hidden="true">
                <div class="reading-progress__fill" :style="{ transform: `scaleX(${readingProgress})` }" />
            </div>

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

            <!-- 首屏：编辑器已出内容但预览尚未完成首次渲染时，用骨架屏覆盖空白内容区；
                 撤除时短淡出，让真实内容从骨架屏下「浮现」而非硬切 -->
            <Transition name="skeleton-fade">
                <div v-if="!isPreviewReady" class="preview-skeleton-overlay">
                    <PreviewSkeleton />
                </div>
            </Transition>

            <Transition name="back-top">
                <button
                    v-show="isBackTopVisible"
                    class="preview-back-top"
                    type="button"
                    v-tooltip="'回到顶部'"
                    aria-label="回到顶部"
                    @click="scrollToTop"
                >
                    <span
                        class="preview-back-top__icon"
                        :style="{ '--icon-url': `url(${backToTopIcon})` }"
                        aria-hidden="true"
                    />
                </button>
            </Transition>

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
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import backToTopIcon from '../assets/back-to-top.svg'
import { SAVE_STATUS } from '../core/documents/persistenceScheduler.js'
import { FILE_LINK_STATUS } from '../workspace/fileSession.js'
import { copyText } from '../composables/clipboard.js'
import { useWorkspace } from '../workspace/workspaceKey.js'
import PanelToolbar from './PanelToolbar.vue'
import PreviewSkeleton from './PreviewSkeleton.vue'
import ResizeDivider from './ResizeDivider.vue'
import TableOfContents from './TableOfContents.vue'

const workspace = useWorkspace()
const { documents, disk, search, layout, headings, html, toc, isPreviewReady } = workspace

const contentRef = ref(null)
const isBackTopVisible = ref(false)
const readingProgress = ref(0)
const hasOverflow = ref(false)

const normalizedWidth = computed(() => (layout.isEditorCollapsed.value ? '100%' : layout.previewWidth.value))

// 状态标签：活动文档关联了本地文件时优先展示文件维度状态（写回/未写回/授权），
// 但 IndexedDB 保存失败是数据安全信号，始终优先露出。
const fileStatus = computed(() => disk.activeStatus.value)
const statusLabel = computed(() => {
    if (documents.saveStatus.value === SAVE_STATUS.FAILED || !fileStatus.value) {
        return documents.saveStatusLabel.value
    }
    return disk.activeStatusLabel.value
})
// 需用户处置的文件状态 → 标签按钮化；IndexedDB 保存失败时让位于失败提示。
const statusAction = computed(() => {
    if (documents.saveStatus.value === SAVE_STATUS.FAILED) return null
    if (fileStatus.value === FILE_LINK_STATUS.PERMISSION) return 'permission'
    if (fileStatus.value === FILE_LINK_STATUS.MISSING) return 'missing'
    return null
})
const runStatusAction = () => {
    if (statusAction.value === 'permission') disk.requestActivePermission()
    else if (statusAction.value === 'missing') disk.resolveMissingFile()
}
const isSaving = computed(() =>
    fileStatus.value ? fileStatus.value === FILE_LINK_STATUS.WRITING : documents.saveStatus.value === SAVE_STATUS.SAVING
)

// 由预览滚动位置算出阅读进度（0~1）。内容不足一屏时隐藏进度条。
const updateReadingProgress = () => {
    const el = contentRef.value
    if (!el) return
    const scrollable = el.scrollHeight - el.clientHeight
    hasOverflow.value = scrollable > 1
    readingProgress.value = hasOverflow.value ? Math.min(1, Math.max(0, el.scrollTop / scrollable)) : 0
}

// 内容变化（切文档 / 编辑）会改变可滚动高度，需重算进度；flush post 确保 DOM 已更新。
watch(html, () => updateReadingProgress(), { flush: 'post' })

// 复制代码块：取同块 <code> 的 textContent（还原后的纯源码，不含高亮标签）写入剪贴板。
const handleCodeCopy = async (button) => {
    const code = button.closest('.code-block')?.querySelector('pre code')
    if (!code) return

    // 只改 label 文字，保留按钮内的打勾 SVG（textContent 赋值会把它清掉）
    const label = button.querySelector('.code-copy__label') || button
    const ok = await copyText(code.textContent || '')
    label.textContent = ok ? '已复制' : '复制失败'
    button.classList.toggle('is-copied', ok)
    window.clearTimeout(button._copyTimer)
    button._copyTimer = window.setTimeout(() => {
        label.textContent = '复制'
        button.classList.remove('is-copied')
    }, 1200)
}

const handlePreviewClick = async (event) => {
    const copyBtn = event.target.closest?.('.code-copy')
    if (copyBtn) {
        event.preventDefault()
        handleCodeCopy(copyBtn)
        return
    }

    // 任务列表勾选回写：浏览器已乐观切换复选框视觉态，这里把状态写回源码对应行，
    // 随后重渲染的 HTML 与之一致；行内容对不上（回写失败）则把视觉态回退。
    const taskCheckbox = event.target.closest?.('input[data-task-line]')
    if (taskCheckbox) {
        const ok = workspace.actions.toggleTaskItem(Number(taskCheckbox.dataset.taskLine), taskCheckbox.checked)
        if (!ok) taskCheckbox.checked = !taskCheckbox.checked
        return
    }

    const anchor = event.target.closest?.('.heading-anchor')
    if (!anchor) return

    const id = anchor.getAttribute('href')?.replace(/^#/, '')
    if (!id) return

    event.preventDefault()

    // 复制「定位分享链接」：与分享一致，链接自包含原文档，并携带锚点直达该标题。
    if (await workspace.share(id)) {
        const textNode = anchor.childNodes[0]
        const originalText = textNode?.textContent
        if (textNode) textNode.textContent = '✓'
        setTimeout(() => {
            if (textNode) textNode.textContent = originalText
        }, 1000)
    }

    workspace.beginPreviewNavigation()
    workspace.getPreview()?.scrollToHeading(id)
    headings.beginNavigation(id)
}

const handleContentScroll = () => {
    isBackTopVisible.value = (contentRef.value?.scrollTop || 0) > 240
    updateReadingProgress()
    workspace.handlePreviewScroll()
}

const scrollToTop = () => {
    workspace.beginPreviewNavigation()
    contentRef.value?.scrollTo({ top: 0, behavior: 'smooth' })
}

const handleTocSelect = (id) => {
    workspace.beginPreviewNavigation()
    const willScroll = workspace.getPreview()?.willScrollToHeading(id)
    workspace.getPreview()?.scrollToHeading(id)
    headings.beginNavigation(id)
    // 点击不产生滚动时（末尾同屏等）无 scroll/scrollend 驱动 active，直接同步落定，
    // 不必干等导航锁的 1200ms 兜底；会真正滚动的场景交回原有滚动/ scrollend 流程。
    if (!willScroll) headings.endNavigation()
}

onMounted(() => {
    workspace.attachPreview(contentRef.value)
    updateReadingProgress()
})

onBeforeUnmount(() => {
    workspace.detachPreview()
})
</script>

<style scoped>
.preview-panel {
    display: flex;
    /* 最小宽度 = 目录实际宽度 + 目录分隔线 + 预览内容区最小宽度，与编辑区共用同一像素最小值。 */
    min-width: calc(var(--toc-width, 0px) + 1px + var(--min-pane-width, 300px));
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

/* 覆盖在真实内容之上：内容为空时挡住空白，首次渲染发布后由 v-if 移除 */
.preview-skeleton-overlay {
    position: absolute;
    inset: 0;
    z-index: var(--z-float);
    display: flex;
    background: var(--color-surface);
    --toc-width: var(--preview-toc-width, 220px);
}

.skeleton-fade-leave-active {
    transition: opacity var(--duration-fast) ease;
}

.skeleton-fade-leave-to {
    opacity: 0;
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

/* 折叠编辑区时会编程式 focus 本容器（tabindex=-1，仅为让预览可键盘滚动），
   移动端浏览器会画出默认蓝色焦点轮廓，顶边显示成进度条下的一条淡蓝线；
   它不在 Tab 序列里，去掉轮廓不影响键盘可达性。 */
.preview-content:focus {
    outline: none;
}

.reading-progress {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    z-index: var(--z-float);
    height: 3px;
    background: transparent;
    pointer-events: none;
}

.reading-progress__fill {
    height: 100%;
    background: linear-gradient(90deg, var(--color-accent), var(--color-accent-strong));
    transform: scaleX(0);
    transform-origin: left center;
    transition: transform 80ms linear;
    will-change: transform;
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
    text-align: left;
}

.preview-save-status {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    flex-shrink: 0;
    color: var(--color-subtle);
    font-size: var(--font-size-sm);
    font-weight: 600;
    line-height: 1.2;
    white-space: nowrap;
}

/* 待授权态：标签是可点击按钮，用强调色提示需要用户动作 */
.preview-save-status--action {
    padding: 2px 8px;
    border: 1px solid color-mix(in srgb, var(--color-accent) 40%, transparent);
    border-radius: var(--radius-full);
    background: color-mix(in srgb, var(--color-accent) 10%, transparent);
    color: var(--color-accent);
    cursor: pointer;
    font: inherit;
    font-size: var(--font-size-sm);
    font-weight: 600;
    transition:
        background var(--duration-fast) ease,
        border-color var(--duration-fast) ease;
}

.preview-save-status--action:hover {
    border-color: color-mix(in srgb, var(--color-accent) 60%, transparent);
    background: color-mix(in srgb, var(--color-accent) 16%, transparent);
}

/* 「保存中」的呼吸圆点：明暗与缩放同步起伏，提示写入正在进行 */
.preview-save-status__dot {
    width: 6px;
    height: 6px;
    border-radius: var(--radius-full);
    background: var(--color-accent);
    animation: save-dot-breathe 1.1s ease-in-out infinite;
}

@keyframes save-dot-breathe {
    50% {
        opacity: 0.35;
        transform: scale(0.72);
    }
}

/* 状态文字切换（保存中 → 已自动保存等）：出快进慢的轻微淡入淡出 */
.save-status-enter-active {
    transition: opacity var(--duration-fast) ease;
}

.save-status-leave-active {
    transition: opacity 0.08s ease;
}

.save-status-enter-from,
.save-status-leave-to {
    opacity: 0;
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

/* 进出场：缩放 + 上浮淡入/淡出。enter 用回弹曲线,并覆盖按钮自身的 hover transition,
   避免两套 transition 列表在进出场期间互相打架。 */
.back-top-enter-active {
    transition:
        opacity var(--duration-fast) ease,
        transform var(--duration-panel) cubic-bezier(0.34, 1.56, 0.64, 1);
}

.back-top-leave-active {
    transition:
        opacity var(--duration-fast) ease,
        transform var(--duration-fast) ease;
}

.back-top-enter-from,
.back-top-leave-to {
    opacity: 0;
    transform: translateY(10px) scale(0.8);
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
        /* 纵向堆叠：横向最小宽度约束不再适用 */
        min-width: 0;
        height: 52%;
    }

    .preview-content {
        padding: 12px 20px;
        font-size: var(--font-size-base);
    }

    .preview-back-top {
        right: 14px;
        /* 叠加安全区，避免被刘海屏 home 条 / 浏览器底部工具栏遮挡 */
        bottom: calc(14px + env(safe-area-inset-bottom));
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

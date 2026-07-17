<template>
    <div class="skeleton-shell" aria-busy="true" aria-label="加载中">
        <!-- 编辑区骨架 -->
        <div class="skeleton-pane skeleton-editor">
            <div class="skeleton-header">
                <!-- 文件切换器占位 -->
                <span class="skeleton-pill skeleton-pill--switcher" />
                <!-- 工具栏按钮占位：方形图标 + md/PDF 宽按钮 + 折叠 -->
                <div class="skeleton-header-actions">
                    <span class="skeleton-btn" />
                    <span class="skeleton-btn" />
                    <span class="skeleton-btn" />
                    <span class="skeleton-btn" />
                    <!-- <span class="skeleton-btn skeleton-btn--wide" />
                    <span class="skeleton-btn skeleton-btn--wide" />
                    <span class="skeleton-btn skeleton-btn--wide" /> -->
                    <span class="skeleton-btn" />
                    <span class="skeleton-btn" />
                    <span class="skeleton-btn" />
                </div>
            </div>
            <!-- CodeMirror 结构：左侧行号槽 + 右侧文本 -->
            <div class="skeleton-editor-body">
                <div class="skeleton-gutter">
                    <span v-for="i in 38" :key="'g' + i" class="skeleton-lineno" />
                </div>
                <div class="skeleton-code">
                    <span
                        v-for="i in 38"
                        :key="'e' + i"
                        class="skeleton-line skeleton-line--mono"
                        :style="{ width: textWidth(i) }"
                    />
                </div>
            </div>
        </div>

        <!-- 分割线 -->
        <div class="skeleton-divider" />

        <!-- 预览区骨架 -->
        <div class="skeleton-pane skeleton-preview">
            <div class="skeleton-header">
                <!-- 文档统计：行数 / 字数 / 字符 -->
                <div class="skeleton-stats">
                    <span class="skeleton-pill skeleton-pill--stat" />
                    <span class="skeleton-pill skeleton-pill--stat" />
                    <span class="skeleton-pill skeleton-pill--stat" />
                </div>
                <span class="skeleton-pill skeleton-pill--saved" />
            </div>

            <PreviewSkeleton />
        </div>
    </div>
</template>

<script setup>
import PreviewSkeleton from './PreviewSkeleton.vue'

const textWidths = [
    '92%',
    '78%',
    '85%',
    '45%',
    '88%',
    '52%',
    '90%',
    '68%',
    '82%',
    '55%',
    '76%',
    '48%',
    '94%',
    '72%',
    '86%',
    '60%',
    '80%',
    '44%',
    '96%',
    '70%',
    '84%',
    '50%',
    '88%',
    '66%',
    '74%',
    '58%',
    '92%',
    '40%',
    '82%',
    '54%',
    '90%',
    '62%',
    '78%',
    '46%'
]

const pick = (arr, i) => arr[(i - 1) % arr.length]
// 编辑区代码行宽度模拟（预览区骨架已下沉到 PreviewSkeleton 组件）
const textWidth = (i) => pick(textWidths, i)
</script>

<style scoped>
.skeleton-shell {
    display: flex;
    flex: 1;
    min-height: 0;
    --toc-width: 220px;
}

.skeleton-pane {
    display: flex;
    min-width: 0;
    overflow: hidden;
    background: var(--color-surface);
    flex-direction: column;
}

.skeleton-editor {
    width: calc((100% - var(--toc-width) - 6px) / 2);
    flex-shrink: 0;
}

.skeleton-preview {
    flex: 1;
}

/* —— 头部（与 panel-header 对齐）—— */
.skeleton-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    height: 40px;
    padding: 6px 14px;
    flex-shrink: 0;
    border-bottom: 1px solid var(--color-border-soft);
    background: var(--color-surface-soft);
}

.skeleton-header-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
}

.skeleton-stats {
    display: inline-flex;
    align-items: center;
    gap: 14px;
    min-width: 0;
}

/* —— 编辑区正文：行号槽 + 代码 —— */
.skeleton-editor-body {
    display: flex;
    flex: 1;
    min-height: 0;
    overflow: hidden;
    background: var(--color-surface);
}

.skeleton-gutter {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 16px 8px 16px 0;
    width: 42px;
    flex-shrink: 0;
    align-items: flex-end;
}

.skeleton-lineno {
    width: 16px;
    height: 12px;
    border-radius: 3px;
    background: var(--color-surface-active);
    opacity: 0.7;
}

.skeleton-code {
    display: flex;
    flex: 1;
    min-width: 0;
    flex-direction: column;
    gap: 8px;
    padding: 16px 18px 16px 12px;
}

.skeleton-line--mono {
    height: 12px;
}

.skeleton-divider {
    width: 6px;
    flex-shrink: 0;
    background: var(--color-surface);
    border-left: 1px solid var(--color-border);
}

/* —— 骨架线条 —— */
.skeleton-line {
    height: 13px;
    border-radius: 5px;
    background: linear-gradient(
        90deg,
        var(--color-skeleton-base) 25%,
        var(--color-skeleton-sheen) 50%,
        var(--color-skeleton-base) 75%
    );
    background-size: 200% 100%;
    animation: skeleton-shimmer 1.6s ease-in-out infinite;
}

/* —— 头部占位块（药丸 / 按钮）—— */
.skeleton-pill,
.skeleton-btn {
    background: linear-gradient(
        90deg,
        var(--color-skeleton-base) 25%,
        var(--color-skeleton-sheen) 50%,
        var(--color-skeleton-base) 75%
    );
    background-size: 200% 100%;
    animation: skeleton-shimmer 1.6s ease-in-out infinite;
    flex-shrink: 0;
}

.skeleton-pill--switcher {
    width: 150px;
    height: 22px;
    border-radius: 6px;
}

.skeleton-pill--stat {
    width: 56px;
    height: 14px;
    border-radius: 5px;
}

.skeleton-pill--saved {
    width: 48px;
    height: 12px;
    border-radius: 5px;
}

.skeleton-btn {
    width: 24px;
    height: 24px;
    border-radius: var(--radius-md);
}

.skeleton-btn--wide {
    width: 42px;
}

@keyframes skeleton-shimmer {
    0% {
        background-position: 200% 0;
    }
    100% {
        background-position: -200% 0;
    }
}

@media (max-width: 900px) {
    /* 与主布局一致：窄屏收起 TOC，编辑区骨架据此按半宽计算 */
    .skeleton-shell {
        --toc-width: 0px;
    }
}

@media (max-width: 768px) {
    .skeleton-shell {
        flex-direction: column;
    }

    .skeleton-editor {
        width: 100%;
        height: 48%;
    }

    .skeleton-preview {
        flex: none;
        height: 52%;
    }

    .skeleton-divider {
        width: 100%;
        height: 6px;
        border-left: none;
        border-top: 1px solid var(--color-border);
    }

    .skeleton-code {
        padding: 12px 14px;
    }
}
</style>

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
                    <span class="skeleton-btn skeleton-btn--wide" />
                    <span class="skeleton-btn skeleton-btn--wide" />
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

            <div class="skeleton-preview-layout">
                <!-- 渲染内容 -->
                <div class="skeleton-body">
                    <span class="skeleton-line skeleton-line--heading" />
                    <span v-for="i in 6" :key="'p' + i" class="skeleton-line" :style="{ width: textWidth(i + 20) }" />

                    <span class="skeleton-line skeleton-line--subheading" />
                    <span v-for="i in 3" :key="'p1' + i" class="skeleton-line" :style="{ width: textWidth(i + 5) }" />

                    <!-- 代码块 -->
                    <span class="skeleton-code-block">
                        <span
                            v-for="i in 4"
                            :key="'c' + i"
                            class="skeleton-line skeleton-line--code"
                            :style="{ width: codeWidth(i) }"
                        />
                    </span>

                    <span v-for="i in 3" :key="'p2' + i" class="skeleton-line" :style="{ width: textWidth(i + 30) }" />
                    <!-- 图片 -->
                    <span class="skeleton-line skeleton-line--image" />
                    <span v-for="i in 7" :key="'p3' + i" class="skeleton-line" :style="{ width: textWidth(i + 40) }" />
                </div>

                <!-- TOC 分割线 -->
                <div class="skeleton-toc-divider" />

                <!-- 目录骨架 -->
                <div class="skeleton-toc">
                    <span class="skeleton-toc-title" />
                    <div class="skeleton-toc-list">
                        <span
                            v-for="i in 9"
                            :key="'t' + i"
                            class="skeleton-toc-item"
                            :style="{ width: tocWidth(i), marginLeft: tocIndent(i) }"
                        />
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
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

const codeWidths = ['65%', '82%', '30%', '58%']
const tocWidths = ['82%', '68%', '90%', '55%', '74%', '60%', '86%', '48%', '70%']
// 目录层级缩进（模拟 h1/h2/h3）
const tocIndents = [0, 12, 12, 24, 0, 12, 24, 12, 0]

const pick = (arr, i) => arr[(i - 1) % arr.length]
const textWidth = (i) => pick(textWidths, i)
const codeWidth = (i) => pick(codeWidths, i)
const tocWidth = (i) => pick(tocWidths, i)
const tocIndent = (i) => `${pick(tocIndents, i)}px`
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

/* —— 预览区正文 —— */
.skeleton-preview-layout {
    display: flex;
    flex: 1;
    min-height: 0;
}

.skeleton-body {
    display: flex;
    flex: 1;
    min-width: 0;
    flex-direction: column;
    gap: 13px;
    padding: 20px 36px;
    overflow: hidden;
    background: var(--color-surface);
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
    background: linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%);
    background-size: 200% 100%;
    animation: skeleton-shimmer 1.6s ease-in-out infinite;
}

.skeleton-line--heading {
    width: 46%;
    height: 22px;
    margin-bottom: 6px;
    border-radius: 6px;
}

.skeleton-line--subheading {
    width: 30%;
    height: 17px;
    margin-top: 10px;
    margin-bottom: 2px;
    border-radius: 6px;
}

.skeleton-line--code {
    height: 12px;
    border-radius: 3px;
    background: linear-gradient(90deg, #e2e8f0 25%, #edf2f7 50%, #e2e8f0 75%);
    background-size: 200% 100%;
    animation: skeleton-shimmer 1.6s ease-in-out infinite;
}

.skeleton-line--image {
    width: 58%;
    height: 84px;
    margin: 6px 0;
    border-radius: 8px;
}

.skeleton-code-block {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px 14px;
    border-radius: 8px;
    background: #f1f5f9;
    margin: 6px 0;
}

/* —— 头部占位块（药丸 / 按钮）—— */
.skeleton-pill,
.skeleton-btn {
    background: linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%);
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

/* —— TOC 骨架 —— */
.skeleton-toc-divider {
    width: 6px;
    flex-shrink: 0;
    background: var(--color-surface);
    border-left: 1px solid var(--color-border);
}

.skeleton-toc {
    width: var(--toc-width);
    flex-shrink: 0;
    padding: 14px 12px;
    overflow: hidden;
    background: var(--color-surface-soft);
}

.skeleton-toc-title {
    display: block;
    width: 40px;
    height: 13px;
    margin: 0 8px 12px;
    border-radius: 5px;
    background: linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%);
    background-size: 200% 100%;
    animation: skeleton-shimmer 1.6s ease-in-out infinite;
}

.skeleton-toc-list {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 4px 8px;
}

.skeleton-toc-item {
    height: 12px;
    border-radius: 5px;
    background: linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%);
    background-size: 200% 100%;
    animation: skeleton-shimmer 1.6s ease-in-out infinite;
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
    .skeleton-shell {
        --toc-width: 0px;
    }

    .skeleton-toc,
    .skeleton-toc-divider {
        display: none;
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

    .skeleton-body {
        padding: 12px 20px;
        gap: 10px;
    }

    .skeleton-code {
        padding: 12px 14px;
    }
}
</style>

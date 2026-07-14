<template>
    <!-- 预览区本文骨架：渲染内容 + 目录。首屏全局骨架与预览区独立等待时共用，保证视觉连续。 -->
    <div class="preview-skeleton-layout" aria-hidden="true">
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
.preview-skeleton-layout {
    display: flex;
    flex: 1;
    min-width: 0;
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
    background: linear-gradient(
        90deg,
        var(--color-skeleton-code-base) 25%,
        var(--color-skeleton-code-sheen) 50%,
        var(--color-skeleton-code-base) 75%
    );
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
    background: var(--color-skeleton-block);
    margin: 6px 0;
}

/* —— TOC 骨架 —— */
.skeleton-toc-divider {
    width: 6px;
    flex-shrink: 0;
    background: var(--color-surface);
    border-left: 1px solid var(--color-border);
}

.skeleton-toc {
    width: var(--toc-width, 220px);
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
    background: linear-gradient(
        90deg,
        var(--color-skeleton-base) 25%,
        var(--color-skeleton-sheen) 50%,
        var(--color-skeleton-base) 75%
    );
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
    background: linear-gradient(
        90deg,
        var(--color-skeleton-base) 25%,
        var(--color-skeleton-sheen) 50%,
        var(--color-skeleton-base) 75%
    );
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
    .skeleton-toc,
    .skeleton-toc-divider {
        display: none;
    }
}

@media (max-width: 768px) {
    .skeleton-body {
        padding: 12px 20px;
        gap: 10px;
    }
}
</style>

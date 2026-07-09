<template>
    <div class="skeleton-shell" aria-busy="true" aria-label="加载中">
        <!-- 编辑区骨架 -->
        <div class="skeleton-pane skeleton-editor">
            <div class="skeleton-header">
                <!-- 文件名 + 操作按钮占位 -->
                <span class="skeleton-line skeleton-line--filename" />
                <div class="skeleton-header-actions">
                    <span v-for="i in 5" :key="'ea' + i" class="skeleton-avatar" />
                </div>
            </div>
            <div class="skeleton-body">
                <!-- 模拟 markdown 文本行 -->
                <span v-for="i in 30" :key="'e' + i" class="skeleton-line" :style="{ width: textWidth(i) }" />
            </div>
        </div>

        <!-- 分割线 -->
        <div class="skeleton-divider" />

        <!-- 预览区骨架 -->
        <div class="skeleton-pane skeleton-preview">
            <div class="skeleton-header">
                <span class="skeleton-line skeleton-line--stats" />
                <span class="skeleton-line skeleton-line--saved" />
            </div>
            <div class="skeleton-body">
                <!-- 标题 -->
                <span class="skeleton-line skeleton-line--heading" />
                <!-- 段落行 -->
                <span v-for="i in 8" :key="'p' + i" class="skeleton-line" :style="{ width: textWidth(i + 20) }" />
                <!-- 代码块 -->
                <span class="skeleton-code-block">
                    <span v-for="i in 4" :key="'c' + i" class="skeleton-line skeleton-line--code" :style="{ width: codeWidth(i) }" />
                </span>
                <!-- 更多内容 -->
                <span class="skeleton-line skeleton-line--subheading" />
                <span v-for="i in 6" :key="'p2' + i" class="skeleton-line" :style="{ width: textWidth(i + 30) }" />
                <span class="skeleton-line skeleton-line--image" />
                <span v-for="i in 4" :key="'p3' + i" class="skeleton-line" :style="{ width: textWidth(i + 40) }" />
            </div>
        </div>
    </div>
</template>

<script setup>
const textWidths = [
    '92%', '78%', '85%', '45%', '88%', '52%', '90%', '68%',
    '82%', '55%', '76%', '48%', '94%', '72%', '86%', '60%',
    '80%', '44%', '96%', '70%', '84%', '50%', '88%', '66%',
    '74%', '58%', '92%', '40%', '82%', '54%', '90%', '62%',
    '78%', '46%', '86%', '64%', '80%', '52%', '94%', '68%',
    '76%', '42%', '88%', '56%', '72%', '48%', '84%', '60%'
]

const codeWidths = ['65%', '82%', '30%', '58%']

const textWidth = (i) => textWidths[(i - 1) % textWidths.length]
const codeWidth = (i) => codeWidths[(i - 1) % codeWidths.length]
</script>

<style scoped>
.skeleton-shell {
    display: flex;
    flex: 1;
    min-height: 0;
}

.skeleton-pane {
    display: flex;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    background: var(--color-surface);
    flex-direction: column;
}

.skeleton-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    height: 40px;
    padding: 6px 14px;
    flex-shrink: 0;
    border-bottom: 1px solid var(--color-border-soft);
    background: linear-gradient(180deg, #ffffff 0%, var(--color-surface-soft) 100%);
}

.skeleton-header-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
}

.skeleton-body {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 14px;
    padding: 20px 22px;
    background: #fbfdff;
}

.skeleton-divider {
    width: 5px;
    flex-shrink: 0;
    background: var(--color-surface);
}

/* 线条 */
.skeleton-line {
    height: 13px;
    border-radius: 5px;
    background: linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%);
    background-size: 200% 100%;
    animation: skeleton-shimmer 1.6s ease-in-out infinite;
}

.skeleton-line--filename {
    width: 150px;
    height: 15px;
}

.skeleton-line--stats {
    width: 200px;
    height: 15px;
}

.skeleton-line--saved {
    width: 64px;
    height: 12px;
}

.skeleton-line--heading {
    width: 42%;
    height: 20px;
    margin-bottom: 4px;
    border-radius: 6px;
}

.skeleton-line--subheading {
    width: 28%;
    height: 16px;
    margin-top: 8px;
    margin-bottom: 2px;
    border-radius: 6px;
}

.skeleton-line--code {
    height: 12px;
    border-radius: 3px;
    background:
        linear-gradient(90deg, #e2e8f0 25%, #edf2f7 50%, #e2e8f0 75%);
    background-size: 200% 100%;
}

.skeleton-line--image {
    width: 55%;
    height: 80px;
    margin: 4px 0;
    border-radius: 8px;
}

/* 按钮占位 */
.skeleton-avatar {
    width: 24px;
    height: 24px;
    border-radius: 6px;
    background:
        linear-gradient(135deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%);
    background-size: 200% 100%;
    flex-shrink: 0;
    animation: skeleton-shimmer 1.6s ease-in-out infinite;
}

/* 代码块 */
.skeleton-code-block {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px 14px;
    border-radius: 8px;
    background: #f1f5f9;
    margin: 4px 0;
}

.skeleton-preview .skeleton-body {
    background: #fcfdff;
}

@keyframes skeleton-shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
}

@media (max-width: 768px) {
    .skeleton-shell {
        flex-direction: column;
    }

    .skeleton-pane {
        flex: none;
        height: 48%;
    }

    .skeleton-preview {
        height: 52%;
    }

    .skeleton-divider {
        width: 100%;
        height: 5px;
    }

    .skeleton-body {
        padding: 12px 14px;
        gap: 10px;
    }
}
</style>

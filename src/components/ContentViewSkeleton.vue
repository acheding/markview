<template>
    <div class="skeleton-shell" aria-busy="true" aria-label="加载中">
        <!-- 编辑区骨架 -->
        <div class="skeleton-pane skeleton-editor">
            <div class="skeleton-header">
                <span class="skeleton-line skeleton-line--name" />
            </div>
            <div class="skeleton-body">
                <span v-for="i in 12" :key="'e' + i" class="skeleton-line" :style="{ width: skeletonWidth(i) }" />
            </div>
        </div>

        <!-- 分割线 -->
        <div class="skeleton-divider" />

        <!-- 预览区骨架 -->
        <div class="skeleton-pane skeleton-preview">
            <div class="skeleton-header">
                <span class="skeleton-line skeleton-line--stats" />
                <span class="skeleton-line skeleton-line--status" />
            </div>
            <div class="skeleton-body">
                <span class="skeleton-line skeleton-line--heading" />
                <span v-for="i in 6" :key="'p' + i" class="skeleton-line" :style="{ width: skeletonWidth(i + 6) }" />
            </div>
        </div>
    </div>
</template>

<script setup>
const widths = ['92%', '78%', '85%', '45%', '88%', '52%', '90%', '68%', '82%', '55%', '76%', '48%', '94%', '72%', '86%', '60%', '80%', '44%']

const skeletonWidth = (i) => widths[(i - 1) % widths.length]
</script>

<style scoped>
.skeleton-shell {
    display: flex;
    flex: 1;
    min-height: 0;
    gap: 0;
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

.skeleton-body {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 10px;
    padding: 20px 22px;
    background: #fbfdff;
}

.skeleton-divider {
    width: 5px;
    flex-shrink: 0;
    background: var(--color-surface);
}

.skeleton-line {
    height: 14px;
    border-radius: 6px;
    background: linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%);
    background-size: 200% 100%;
    animation: skeleton-shimmer 1.6s ease-in-out infinite;
}

.skeleton-line--name {
    width: 160px;
    height: 16px;
}

.skeleton-line--stats {
    width: 220px;
    height: 15px;
}

.skeleton-line--status {
    width: 72px;
    height: 13px;
}

.skeleton-line--heading {
    width: 38%;
    height: 18px;
    margin-bottom: 4px;
}

@keyframes skeleton-shimmer {
    0% {
        background-position: 200% 0;
    }
    100% {
        background-position: -200% 0;
    }
}

.skeleton-preview .skeleton-body {
    background: #fcfdff;
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
}
</style>

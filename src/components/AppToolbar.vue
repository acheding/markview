<template>
    <header class="toolbar">
        <div class="toolbar__brand">
            <img class="toolbar__mark" :src="iconUrl" alt="" aria-hidden="true" />
            <span class="toolbar__header">
                <span class="toolbar__title">MarkView</span>
                <span class="toolbar__subtitle">本地 Markdown 实时预览工具</span>
            </span>
        </div>

        <DocumentSearch class="toolbar__search" />
        <ThemeToggle />
    </header>
</template>

<script setup>
import DocumentSearch from './DocumentSearch.vue'
import ThemeToggle from './ThemeToggle.vue'

// 复用与站点 favicon / PWA 图标一致的 icon.svg，随 base 路径解析。
const iconUrl = `${import.meta.env.BASE_URL}icon.svg`
</script>

<style scoped>
.toolbar {
    position: relative;
    z-index: var(--z-toolbar);
    display: flex;
    align-items: center;
    height: 58px;
    gap: 12px;
    padding: 0 22px;
    background: var(--color-surface-glass);
    border-bottom: 1px solid var(--color-border-soft);
    backdrop-filter: blur(12px);
    flex-shrink: 0;
    user-select: none;
}

/* 品牌占据左侧并用 auto 外边距把搜索框+主题按钮推到右侧；
   搜索框展开时向左吃掉这段弹性空间，右边缘（贴主题按钮）保持不动，按钮不再被顶。 */
.toolbar__brand {
    display: inline-flex;
    align-items: center;
    gap: 11px;
    min-width: 0;
    margin-right: auto;
}

.toolbar__search {
    flex-shrink: 0;
}

.toolbar__mark {
    width: 32px;
    height: 32px;
    flex-shrink: 0;
    border-radius: var(--radius-lg);
    box-shadow: 0 3px 12px rgb(var(--color-accent-channel) / 18%);
}

.toolbar__header {
    display: inline-flex;
    min-width: 0;
    flex-direction: column;
    justify-content: center;
    gap: 2px;
}

.toolbar__title {
    color: var(--color-text);
    font-size: var(--font-size-lg);
    font-weight: 760;
    line-height: 1.2;
}

.toolbar__subtitle {
    color: var(--color-muted);
    font-size: var(--font-size-sm);
    line-height: 1.2;
    white-space: nowrap;
}

@media (max-width: 768px) {
    .toolbar {
        height: auto;
        min-height: 58px;
        padding: 8px 14px;
        gap: 8px;
        flex-wrap: wrap;
    }

    .toolbar__subtitle {
        white-space: normal;
    }
}
</style>

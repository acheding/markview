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
        <a
            v-tooltip="'在 GitHub 上查看源码'"
            class="toolbar__github"
            href="https://github.com/acheding/markview"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="在 GitHub 上查看 MarkView 源码"
        >
            <svg class="toolbar__github-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path
                    d="M12 .7a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2.23c-3.23.7-3.91-1.37-3.91-1.37-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.71.08-.71 1.17.08 1.78 1.2 1.78 1.2 1.04 1.77 2.72 1.26 3.38.96.1-.75.4-1.26.74-1.55-2.58-.3-5.29-1.29-5.29-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.16 1.18a10.97 10.97 0 0 1 5.76 0c2.19-1.49 3.15-1.18 3.15-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.72 5.39-5.31 5.68.42.36.79 1.07.79 2.16v3.2c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .7Z"
                />
            </svg>
        </a>
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

.toolbar__github {
    display: inline-grid;
    place-items: center;
    width: 34px;
    height: 34px;
    flex-shrink: 0;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    color: var(--color-muted);
    box-shadow: 0 1px 2px rgb(15 23 42 / 4%);
    transition:
        transform var(--duration-fast) ease,
        background var(--duration-fast) ease,
        border-color var(--duration-fast) ease,
        color var(--duration-fast) ease,
        box-shadow var(--duration-fast) ease;
}

.toolbar__github:hover {
    border-color: color-mix(in srgb, var(--color-accent) 38%, transparent);
    background: var(--color-surface-active);
    color: var(--color-accent);
    box-shadow: 0 6px 14px rgb(var(--color-accent-channel) / 12%);
    transform: translateY(-1px);
}

.toolbar__github:active {
    transform: translateY(0);
}

.toolbar__github:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--color-accent) 42%, transparent);
    outline-offset: 2px;
}

.toolbar__github-icon {
    width: 18px;
    height: 18px;
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

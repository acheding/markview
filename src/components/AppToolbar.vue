<template>
    <header class="toolbar">
        <div class="toolbar__brand">
            <span class="toolbar__mark" aria-hidden="true">Md</span>
            <span class="toolbar__header">
                <span class="toolbar__title">MarkView</span>
                <span class="toolbar__subtitle">本地 Markdown 实时预览工具</span>
            </span>
        </div>

        <DocumentSearch />
    </header>
</template>

<script setup>
import DocumentSearch from './DocumentSearch.vue'
</script>

<style scoped>
.toolbar {
    position: relative;
    z-index: var(--z-toolbar);
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 58px;
    gap: 18px;
    padding: 0 22px;
    background: var(--color-surface-glass);
    border-bottom: 1px solid var(--color-border-soft);
    backdrop-filter: blur(12px);
    flex-shrink: 0;
    user-select: none;
}

.toolbar__brand {
    display: inline-flex;
    align-items: center;
    gap: 11px;
    min-width: 0;
}

.toolbar__mark {
    display: inline-grid;
    place-items: center;
    width: 32px;
    height: 32px;
    flex-shrink: 0;
    border: 1px solid transparent;
    border-radius: var(--radius-lg);
    background: var(--color-accent-solid);
    color: #ffffff;
    box-shadow: 0 3px 12px rgb(var(--color-accent-channel) / 18%);
    font-size: var(--font-size-sm);
    font-weight: 800;
    letter-spacing: 0;
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

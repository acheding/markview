<template>
    <header class="toolbar">
        <div class="toolbar__brand">
            <span class="toolbar__mark" aria-hidden="true">Md</span>
            <span class="toolbar__header">
                <span class="toolbar__title">MarkView</span>
                <span class="toolbar__subtitle">本地 Markdown 实时预览工具</span>
            </span>
        </div>

        <DocumentSearch :files="files" :active-file-id="activeFileId" @select="$emit('select-search-result', $event)" />
    </header>
</template>

<script setup>
import DocumentSearch from './DocumentSearch.vue'

defineProps({
    files: {
        type: Array,
        default: () => []
    },
    activeFileId: {
        type: String,
        default: ''
    }
})

defineEmits(['select-search-result'])
</script>

<style scoped>
.toolbar {
    position: relative;
    z-index: 60;
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 58px;
    gap: 18px;
    padding: 0 22px;
    background: rgb(255 255 255 / 86%);
    border-bottom: 1px solid var(--color-border-soft);
    box-shadow: 0 1px 0 rgb(255 255 255 / 80%) inset;
    backdrop-filter: blur(14px);
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
    border: 1px solid color-mix(in srgb, var(--color-accent) 32%, #ffffff);
    border-radius: 8px;
    background: linear-gradient(145deg, #ffffff 0%, #e6fffb 100%);
    color: var(--color-accent-strong);
    box-shadow: 0 8px 20px rgb(15 118 110 / 14%);
    font-size: 12px;
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
    font-size: 15px;
    font-weight: 760;
    line-height: 1.2;
}

.toolbar__subtitle {
    color: var(--color-muted);
    font-size: 12px;
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

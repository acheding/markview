<template>
    <section
        ref="panelRef"
        class="editor-panel"
        :class="{ 'is-collapsed': layout.isEditorCollapsed.value }"
        :style="{ width: normalizedWidth }"
    >
        <div class="panel-header">
            <PanelToolbar context="editor" />
        </div>

        <div ref="hostRef" class="editor-surface" />
    </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useWorkspace } from '../workspace/workspaceKey.js'
import PanelToolbar from './PanelToolbar.vue'

const workspace = useWorkspace()
const { layout } = workspace

const panelRef = ref(null)
const hostRef = ref(null)

const normalizedWidth = computed(() => {
    if (layout.isEditorCollapsed.value) return '0'
    const width = layout.editorWidth.value
    return typeof width === 'number' ? `${width}%` : width
})

onMounted(() => {
    layout.editorPanelRef.value = panelRef.value
    workspace.attachEditor(hostRef.value)
})

onBeforeUnmount(() => {
    workspace.detachEditor()
    layout.editorPanelRef.value = null
})
</script>

<style scoped>
.editor-panel {
    display: flex;
    min-width: 22%;
    overflow: hidden;
    background: var(--color-surface);
    flex-direction: column;
    transition: opacity 0.22s ease;
}

.editor-panel.is-collapsed {
    min-width: 0 !important;
    opacity: 0;
    pointer-events: none;
}

.editor-surface {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    background: var(--color-surface);
}

.editor-surface :deep(.cm-editor) {
    height: 100%;
}

@media (max-width: 768px) {
    .editor-panel {
        width: 100% !important;
        height: 48%;
        border-right: none;
        border-bottom: 1px solid var(--color-border-soft);
    }

    .editor-panel.is-collapsed {
        height: 0 !important;
        min-height: 0 !important;
        border-bottom: none;
    }
}
</style>

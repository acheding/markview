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

const normalizedWidth = computed(() => (layout.isEditorCollapsed.value ? '0' : layout.editorWidthStyle.value))

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
    /* 编辑区与预览内容区共用像素最小宽度；max-width 兜底窗口变窄时不挤压预览区（预留 TOC + 两条分隔线 + 预览内容最小宽度）。 */
    min-width: var(--min-pane-width, 300px);
    max-width: calc(100% - var(--toc-width, 0px) - 2px - var(--min-pane-width, 300px));
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
        /* 纵向堆叠：横向宽度约束不再适用 */
        min-width: 0;
        max-width: none;
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

<template>
    <div class="app-shell">
        <AppToolbar />

        <main
            :ref="setMainPanel"
            class="main-panel"
            :class="{ 'is-editor-collapsed': layout.isEditorCollapsed.value, 'is-resizing': layout.isResizing.value }"
            :style="{ '--toc-width': layout.tocWidthStyle.value, '--min-pane-width': `${layout.minPaneWidth}px` }"
        >
            <ContentViewSkeleton v-if="!documents.isReady.value" />

            <template v-else>
                <EditorPane />

                <ResizeDivider
                    :active="layout.isResizing.value"
                    :collapsed="layout.isEditorCollapsed.value"
                    @resize-start="layout.startResize"
                />

                <PreviewPane />
            </template>
        </main>

        <AppToast />
        <AppConfirm />
        <CommandPalette />
    </div>
</template>

<script setup>
import { provide } from 'vue'
import AppConfirm from './components/AppConfirm.vue'
import AppToast from './components/AppToast.vue'
import AppToolbar from './components/AppToolbar.vue'
import CommandPalette from './components/CommandPalette.vue'
import ContentViewSkeleton from './components/ContentViewSkeleton.vue'
import EditorPane from './components/EditorPane.vue'
import PreviewPane from './components/PreviewPane.vue'
import ResizeDivider from './components/ResizeDivider.vue'
import { useDocumentTitle } from './composables/useDocumentTitle.js'
import { createWorkspace } from './workspace/createWorkspace.js'
import { WORKSPACE_KEY } from './workspace/workspaceKey.js'

const workspace = createWorkspace()
provide(WORKSPACE_KEY, workspace)

const { documents, layout } = workspace

useDocumentTitle({ activeFile: documents.activeFile, saveStatus: documents.saveStatus })

const setMainPanel = (el) => {
    layout.containerRef.value = el
}
</script>

<style scoped>
.app-shell {
    display: flex;
    height: 100vh; /* 兜底：不支持 dvh 的旧浏览器 */
    height: 100dvh; /* 跟随移动端工具栏收放的动态视口，避免底部被浏览器工具栏遮挡 */
    overflow: hidden;
    background: var(--color-bg);
    flex-direction: column;
}

.main-panel {
    position: relative;
    display: flex;
    flex: 1;
    min-height: 0;
    margin: 12px;
    overflow: hidden;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-surface);
    box-shadow: var(--shadow-panel);
    --toc-width: 220px;
}

/* 非拖拽时启用面板过渡（折叠/展开动画） */
/* 桌面端（横向）：宽度过渡 */
@media (min-width: 769px) {
    .main-panel:not(.is-resizing) :deep(.editor-panel),
    .main-panel:not(.is-resizing) :deep(.preview-panel) {
        transition:
            width var(--duration-panel) ease,
            min-width var(--duration-panel) ease;
    }

    .main-panel:not(.is-resizing) :deep(.divider) {
        transition: width var(--duration-panel) ease;
    }
}

/* 移动端（纵向）：高度过渡 */
@media (max-width: 768px) {
    .main-panel:not(.is-resizing) :deep(.editor-panel),
    .main-panel:not(.is-resizing) :deep(.preview-panel) {
        transition:
            height var(--duration-panel) ease,
            min-height var(--duration-panel) ease;
    }
}

.main-panel.is-editor-collapsed :deep(.preview-panel) {
    min-width: 0;
}

@media (max-width: 1120px) {
    .main-panel {
        --toc-width: 180px;
    }
}

@media (max-width: 900px) {
    .main-panel {
        --toc-width: 0px;
    }
}

@media (max-width: 768px) {
    .main-panel {
        flex-direction: column;
        margin: 8px;
    }

    .main-panel.is-editor-collapsed :deep(.preview-panel) {
        height: 100%;
    }
}
</style>

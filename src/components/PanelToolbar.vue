<template>
    <div class="panel-toolbar">
        <FileSwitcher class="panel-toolbar__switcher" />

        <div class="panel-toolbar__actions">
            <!-- 编辑区专属：新建、清空 -->
            <template v-if="context === 'editor'">
                <button
                    class="toolbar-action-button"
                    type="button"
                    v-tooltip="{ text: '新建文档', keys: shortcutLabel('new') }"
                    aria-label="新建文档"
                    @click="createNewDocument"
                >
                    <span
                        class="toolbar-action-icon"
                        :style="{ '--icon-url': `url(${newFileIcon})` }"
                        aria-hidden="true"
                    />
                </button>
                <button
                    class="toolbar-action-button"
                    type="button"
                    v-tooltip="{ text: '清空内容', keys: shortcutLabel('clear') }"
                    aria-label="清空内容"
                    @click="actions.clearContent()"
                >
                    <span
                        class="toolbar-action-icon"
                        :style="{ '--icon-url': `url(${clearContentIcon})` }"
                        aria-hidden="true"
                    />
                </button>
            </template>

            <!-- 共用：打开与导入并存——打开保留句柄可写回（仅支持 File System Access 时展示）；
                 导入始终展示，拷贝副本进工作区、不关联磁盘 -->
            <button
                v-if="disk.isSupported"
                class="toolbar-action-button"
                type="button"
                v-tooltip="{ text: '打开本地文件', keys: shortcutLabel('open') }"
                aria-label="打开本地文件"
                @click="disk.openFilePicker()"
            >
                <span
                    class="toolbar-action-icon"
                    :style="{ '--icon-url': `url(${openLocalFileIcon})` }"
                    aria-hidden="true"
                />
            </button>
            <button
                class="toolbar-action-button"
                type="button"
                v-tooltip="{ text: '导入文件', keys: shortcutLabel('import') }"
                aria-label="导入文件"
                @click="openImportPicker"
            >
                <span
                    class="toolbar-action-icon"
                    :style="{ '--icon-url': `url(${importFileIcon})` }"
                    aria-hidden="true"
                />
            </button>

            <!-- 共用：导出 / 打印收进「更多」菜单，避免小屏挤压文件名 -->
            <PanelToolbarMenu />

            <!-- 共用：复制分享链接（压缩进 URL，无需后端） -->
            <button
                class="toolbar-action-button"
                type="button"
                v-tooltip="{ text: '复制分享链接', keys: shortcutLabel('share') }"
                aria-label="复制分享链接"
                @click="share"
            >
                <span class="toolbar-action-icon" :style="{ '--icon-url': `url(${shareIcon})` }" aria-hidden="true" />
            </button>

            <!-- 编辑区专属：折叠(<) -->
            <button
                v-if="context === 'editor'"
                class="toolbar-action-button"
                type="button"
                v-tooltip="{ text: '折叠编辑区', keys: shortcutLabel('toggle-editor') }"
                aria-label="折叠编辑区"
                @click="actions.setEditorCollapsed(true)"
            >
                <span
                    class="toolbar-action-icon panel-toolbar__collapse-icon"
                    :style="{ '--icon-url': `url(${collapseEditorIcon})` }"
                    aria-hidden="true"
                />
            </button>

            <!-- 预览区专属：展开(>) -->
            <button
                v-if="context === 'preview'"
                class="toolbar-action-button"
                type="button"
                v-tooltip="{ text: '展开编辑区', keys: shortcutLabel('toggle-editor') }"
                aria-label="展开编辑区"
                @click="actions.setEditorCollapsed(false)"
            >
                <span
                    class="toolbar-action-icon panel-toolbar__collapse-icon"
                    :style="{ '--icon-url': `url(${expandEditorIcon})` }"
                    aria-hidden="true"
                />
            </button>
        </div>
    </div>
</template>

<script setup>
import clearContentIcon from '../assets/clear-content.svg'
import collapseEditorIcon from '../assets/collapse-editor.svg'
import expandEditorIcon from '../assets/expand-editor.svg'
import importFileIcon from '../assets/import-file.svg'
import newFileIcon from '../assets/new-file.svg'
import openLocalFileIcon from '../assets/open-file.svg'
import shareIcon from '../assets/share.svg'
import { shortcutLabel } from '../composables/shortcuts.js'
import { useWorkspace } from '../workspace/workspaceKey.js'
import FileSwitcher from './FileSwitcher.vue'
import PanelToolbarMenu from './PanelToolbarMenu.vue'

defineProps({
    context: {
        type: String,
        default: 'editor',
        validator: (v) => ['editor', 'preview'].includes(v)
    }
})

const { disk, actions, share, openImportPicker, createNewDocument } = useWorkspace()
</script>

<style scoped>
.panel-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    width: 100%;
    min-width: 0;
}

.panel-toolbar__switcher {
    flex: 1;
    min-width: 0;
}

.panel-toolbar__actions {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
}

@media (max-width: 768px) {
    .panel-toolbar__switcher {
        flex: 1;
    }

    /* 移动端为上下布局，折叠/展开箭头旋转 90° 指向上下方向 */
    .panel-toolbar__collapse-icon {
        transform: rotate(90deg);
    }
}
</style>

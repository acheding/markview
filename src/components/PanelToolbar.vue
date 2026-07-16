<template>
    <div class="panel-toolbar">
        <FileSwitcher class="panel-toolbar__switcher" />

        <div class="panel-toolbar__actions">
            <!-- 编辑区专属：新建、清空 -->
            <template v-if="context === 'editor'">
                <button
                    class="toolbar-action-button"
                    type="button"
                    title="新建文档"
                    aria-label="新建文档"
                    @click="documents.create()"
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
                    title="清空内容"
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

            <!-- 共用：导入 -->
            <button
                class="toolbar-action-button"
                type="button"
                title="导入 Markdown"
                aria-label="导入 Markdown"
                @click="triggerImport"
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
                title="复制分享链接"
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
                title="折叠编辑区"
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
                title="展开编辑区"
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

        <input
            ref="fileInputRef"
            class="panel-toolbar__file-input"
            type="file"
            accept=".md,.markdown,text/markdown,text/plain"
            multiple
            @change="handleFileInput"
        />
    </div>
</template>

<script setup>
import { ref } from 'vue'
import clearContentIcon from '../assets/clear-content.svg'
import collapseEditorIcon from '../assets/collapse-editor.svg'
import expandEditorIcon from '../assets/expand-editor.svg'
import importFileIcon from '../assets/import-file.svg'
import newFileIcon from '../assets/new-file.svg'
import shareIcon from '../assets/share.svg'
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

const { documents, actions, share, importFiles } = useWorkspace()

const fileInputRef = ref(null)

const triggerImport = () => {
    fileInputRef.value?.click()
}

const handleFileInput = async (event) => {
    try {
        await importFiles(event.target.files)
    } finally {
        // 允许再次选择同一文件触发 change。
        event.target.value = ''
    }
}
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

.panel-toolbar__file-input {
    display: none;
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

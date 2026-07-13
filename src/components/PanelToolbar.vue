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

            <!-- 共用：导入、导出 md、导出 PDF -->
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
            <button
                class="toolbar-action-button toolbar-action-button--format"
                type="button"
                title="导出 Markdown"
                aria-label="导出 Markdown"
                @click="exporting.exportActiveFile()"
            >
                <span
                    class="toolbar-action-icon"
                    :style="{ '--icon-url': `url(${exportFileIcon})` }"
                    aria-hidden="true"
                />
                <span class="toolbar-action-label">md</span>
            </button>
            <button
                class="toolbar-action-button toolbar-action-button--format"
                type="button"
                :title="exporting.isExportingPdf.value ? '正在导出 PDF…' : '导出 PDF'"
                :aria-label="exporting.isExportingPdf.value ? '正在导出 PDF' : '导出 PDF'"
                :disabled="exporting.isExportingPdf.value"
                @click="exporting.exportPdf()"
            >
                <span v-if="exporting.isExportingPdf.value" class="toolbar-action-spinner" aria-hidden="true" />
                <span
                    v-else
                    class="toolbar-action-icon"
                    :style="{ '--icon-url': `url(${exportPdfIcon})` }"
                    aria-hidden="true"
                />
                <span class="toolbar-action-label">PDF</span>
            </button>

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
                    class="toolbar-action-icon"
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
                    class="toolbar-action-icon"
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
            @change="importFiles"
        />
    </div>
</template>

<script setup>
import { ref } from 'vue'
import clearContentIcon from '../assets/clear-content.svg'
import collapseEditorIcon from '../assets/collapse-editor.svg'
import expandEditorIcon from '../assets/expand-editor.svg'
import exportFileIcon from '../assets/export-file.svg'
import exportPdfIcon from '../assets/export-pdf.svg'
import importFileIcon from '../assets/import-file.svg'
import newFileIcon from '../assets/new-file.svg'
import shareIcon from '../assets/share.svg'
import { useWorkspace } from '../workspace/workspaceKey.js'
import FileSwitcher from './FileSwitcher.vue'

defineProps({
    context: {
        type: String,
        default: 'editor',
        validator: (v) => ['editor', 'preview'].includes(v)
    }
})

const { documents, actions, exporting, share } = useWorkspace()

const fileInputRef = ref(null)

const triggerImport = () => {
    fileInputRef.value?.click()
}

const importFiles = async (event) => {
    const selectedFiles = Array.from(event.target.files || [])
    if (!selectedFiles.length) return

    try {
        for (const file of selectedFiles) {
            const content = await file.text()
            documents.importFile({ name: file.name, content })
        }
    } catch (error) {
        console.warn('Markdown import failed:', error)
        alert('导入失败，请确认文件可读取。')
    } finally {
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

.toolbar-action-button {
    display: inline-grid;
    place-items: center;
    width: 24px;
    height: 24px;
    padding: 0;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    color: var(--color-muted);
    cursor: pointer;
    box-shadow: 0 1px 2px rgb(15 23 42 / 4%);
    transition:
        transform var(--duration-fast) ease,
        background var(--duration-fast) ease,
        border-color var(--duration-fast) ease,
        color var(--duration-fast) ease,
        box-shadow var(--duration-fast) ease;
}

.toolbar-action-button--format {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: auto;
    min-width: 42px;
    gap: 3px;
    padding: 0 6px;
}

.toolbar-action-button:hover {
    border-color: color-mix(in srgb, var(--color-accent) 38%, #ffffff);
    background: var(--color-surface-active);
    color: var(--color-accent);
    box-shadow: 0 6px 14px rgb(var(--color-accent-channel) / 12%);
    transform: translateY(-1px);
}

.toolbar-action-button:active {
    transform: translateY(0);
}

.toolbar-action-button:disabled {
    cursor: default;
    color: var(--color-subtle);
}

.toolbar-action-button:disabled:hover {
    border-color: var(--color-border);
    background: var(--color-surface);
    color: var(--color-subtle);
    box-shadow: 0 1px 2px rgb(15 23 42 / 4%);
    transform: none;
}

.toolbar-action-icon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    background: currentColor;
    mask: var(--icon-url) center / contain no-repeat;
    -webkit-mask: var(--icon-url) center / contain no-repeat;
}

.toolbar-action-label {
    color: currentColor;
    font-size: var(--font-size-xs);
    font-weight: 750;
    line-height: 1;
    white-space: nowrap;
}

.toolbar-action-spinner {
    width: 14px;
    height: 14px;
    border: 2px solid color-mix(in srgb, var(--color-accent) 28%, transparent);
    border-top-color: var(--color-accent);
    border-radius: 50%;
    animation: toolbar-action-spin 0.6s linear infinite;
}

@keyframes toolbar-action-spin {
    to {
        transform: rotate(360deg);
    }
}

.panel-toolbar__file-input {
    display: none;
}

@media (max-width: 768px) {
    .panel-toolbar__switcher {
        flex: 1;
    }
}
</style>

<template>
    <div ref="menuRef" class="toolbar-menu">
        <button
            class="toolbar-action-button"
            type="button"
            :aria-expanded="isOpen"
            aria-haspopup="menu"
            title="导出"
            aria-label="导出"
            @click="isOpen = !isOpen"
        >
            <span class="toolbar-menu__dots" aria-hidden="true">⋯</span>
        </button>

        <div v-if="isOpen" class="toolbar-menu__list" role="menu">
            <button class="toolbar-menu__item" type="button" role="menuitem" @click="run(exporting.exportActiveFile)">
                <span class="toolbar-action-icon" :style="iconStyle(exportFileIcon)" aria-hidden="true" />
                导出 Markdown
            </button>
            <button class="toolbar-menu__item" type="button" role="menuitem" @click="run(exporting.exportHtml)">
                <span class="toolbar-action-icon" :style="iconStyle(exportHtmlIcon)" aria-hidden="true" />
                导出 HTML
            </button>
            <button
                class="toolbar-menu__item"
                type="button"
                role="menuitem"
                :disabled="exporting.isExportingPdf.value"
                @click="run(exporting.exportPdf)"
            >
                <span class="toolbar-action-icon" :style="iconStyle(exportPdfIcon)" aria-hidden="true" />
                {{ exporting.isExportingPdf.value ? '正在导出 PDF…' : '导出 PDF' }}
            </button>
            <button class="toolbar-menu__item" type="button" role="menuitem" @click="run(exporting.print)">
                <span class="toolbar-action-icon" :style="iconStyle(printIcon)" aria-hidden="true" />
                打印 / 打印为 PDF
            </button>
        </div>
    </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import exportFileIcon from '../assets/export-file.svg'
import exportHtmlIcon from '../assets/export-html.svg'
import exportPdfIcon from '../assets/export-pdf.svg'
import printIcon from '../assets/print.svg'
import { useWorkspace } from '../workspace/workspaceKey.js'

const { exporting } = useWorkspace()

const isOpen = ref(false)
const menuRef = ref(null)

const iconStyle = (url) => ({ '--icon-url': `url(${url})` })

// 执行动作后关闭菜单；PDF 导出中禁用项不会走到这里（button:disabled）。
const run = (action) => {
    isOpen.value = false
    action?.()
}

const closeOnOutsideClick = (event) => {
    if (!menuRef.value?.contains(event.target)) isOpen.value = false
}

onMounted(() => document.addEventListener('pointerdown', closeOnOutsideClick))
onBeforeUnmount(() => document.removeEventListener('pointerdown', closeOnOutsideClick))
</script>

<style scoped>
.toolbar-menu {
    position: relative;
    display: inline-flex;
}

.toolbar-menu__dots {
    font-size: var(--font-size-lg);
    font-weight: 800;
    line-height: 1;
}

.toolbar-menu__list {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    z-index: var(--z-file-menu);
    width: max-content;
    min-width: 168px;
    padding: 6px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-surface);
    box-shadow: var(--shadow-menu);
}

.toolbar-menu__item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    height: 34px;
    padding: 0 12px;
    border: none;
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--color-text);
    cursor: pointer;
    font: inherit;
    font-size: var(--font-size-md);
    text-align: left;
    white-space: nowrap;
    transition: background var(--duration-fast) ease;
}

.toolbar-menu__item:hover {
    background: var(--color-surface-soft);
    color: var(--color-accent);
}

.toolbar-menu__item:disabled {
    color: var(--color-subtle);
    cursor: default;
    background: transparent;
}
</style>

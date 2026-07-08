<template>
    <section class="editor-panel" :style="{ width: normalizedWidth }">
        <div class="panel-header">
            <FileSwitcher
                :files="files"
                :active-file-id="activeFileId"
                @select-file="$emit('select-file', $event)"
                @delete-file="$emit('delete-file', $event)"
            />
            <div class="editor-actions">
                <button class="editor-action-button" type="button" title="新建文档" aria-label="新建文档" @click="$emit('create-file')">
                    <span class="editor-action-icon" :style="{ '--icon-url': `url(${newFileIcon})` }" aria-hidden="true" />
                </button>
                <button class="editor-action-button" type="button" title="清空内容" aria-label="清空内容" @click="$emit('clear')">
                    <span class="editor-action-icon" :style="{ '--icon-url': `url(${clearContentIcon})` }" aria-hidden="true" />
                </button>
                <button class="editor-action-button" type="button" title="导入 Markdown" aria-label="导入 Markdown" @click="triggerImport">
                    <span class="editor-action-icon" :style="{ '--icon-url': `url(${importFileIcon})` }" aria-hidden="true" />
                </button>
                <button class="editor-action-button" type="button" title="导出当前 Markdown" aria-label="导出当前 Markdown" @click="$emit('export-file')">
                    <span class="editor-action-icon" :style="{ '--icon-url': `url(${exportFileIcon})` }" aria-hidden="true" />
                </button>
            </div>
        </div>

        <input
            ref="fileInputRef"
            class="editor-file-input"
            type="file"
            accept=".md,.markdown,text/markdown,text/plain"
            multiple
            @change="importFiles"
        >

        <textarea
            ref="textareaRef"
            class="editor-textarea"
            :value="modelValue"
            spellcheck="false"
            placeholder="在此输入 Markdown 内容..."
            @input="$emit('update:modelValue', $event.target.value)"
            @scroll="$emit('scroll')"
        />
    </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import clearContentIcon from '../assets/clear-content.svg'
import exportFileIcon from '../assets/export-file.svg'
import importFileIcon from '../assets/import-file.svg'
import newFileIcon from '../assets/new-file.svg'
import FileSwitcher from './FileSwitcher.vue'

const props = defineProps({
    modelValue: {
        type: String,
        required: true,
    },
    files: {
        type: Array,
        default: () => [],
    },
    activeFileId: {
        type: String,
        default: '',
    },
    width: {
        type: [Number, String],
        required: true,
    },
})

const emit = defineEmits([
    'update:modelValue',
    'clear',
    'scroll',
    'select-file',
    'create-file',
    'delete-file',
    'import-file',
    'export-file',
])

const textareaRef = ref(null)
const fileInputRef = ref(null)
const normalizedWidth = computed(() => (
    typeof props.width === 'number' ? `${props.width}%` : props.width
))

const triggerImport = () => {
    fileInputRef.value?.click()
}

const importFiles = async (event) => {
    const selectedFiles = Array.from(event.target.files || [])
    if (!selectedFiles.length) return

    try {
        for (const file of selectedFiles) {
            const content = await file.text()
            emit('import-file', {
                name: file.name,
                content,
            })
        }
    } catch (error) {
        console.warn('Markdown import failed:', error)
        alert('导入失败，请确认文件可读取。')
    } finally {
        event.target.value = ''
    }
}

const getLineStartIndex = (value, lineNumber) => {
    if (lineNumber <= 1) return 0

    let line = 1
    let index = 0

    while (line < lineNumber) {
        const nextIndex = value.indexOf('\n', index)
        if (nextIndex < 0) return value.length

        index = nextIndex + 1
        line += 1
    }

    return index
}

const getRenderedLineTop = (textarea, value, start) => {
    const computedStyle = getComputedStyle(textarea)
    const mirror = document.createElement('div')
    const marker = document.createElement('span')
    const copiedProperties = [
        'border',
        'boxSizing',
        'fontFamily',
        'fontSize',
        'fontWeight',
        'letterSpacing',
        'lineHeight',
        'padding',
        'tabSize',
        'textTransform',
        'width',
        'wordBreak',
        'wordSpacing',
    ]

    copiedProperties.forEach((property) => {
        mirror.style[property] = computedStyle[property]
    })

    mirror.style.position = 'absolute'
    mirror.style.left = '-9999px'
    mirror.style.top = '0'
    mirror.style.height = 'auto'
    mirror.style.overflow = 'hidden'
    mirror.style.overflowWrap = 'break-word'
    mirror.style.visibility = 'hidden'
    mirror.style.whiteSpace = 'pre-wrap'
    mirror.style.width = `${textarea.clientWidth}px`
    mirror.textContent = value.slice(0, start) || '\u200b'
    marker.textContent = '\u200b'
    mirror.appendChild(marker)
    document.body.appendChild(mirror)

    const top = marker.offsetTop
    document.body.removeChild(mirror)

    return top
}

const focusLine = (lineNumber) => {
    const textarea = textareaRef.value
    if (!textarea) return

    const line = Math.max(1, Number(lineNumber) || 1)
    const value = textarea.value
    const start = getLineStartIndex(value, line)
    const nextLineIndex = value.indexOf('\n', start)
    const end = nextLineIndex < 0 ? value.length : nextLineIndex
    const renderedTop = getRenderedLineTop(textarea, value, start)

    textarea.focus()
    textarea.setSelectionRange(start, end)

    requestAnimationFrame(() => {
        textarea.scrollTo({
            top: Math.max(0, renderedTop - textarea.clientHeight * 0.36),
            behavior: 'smooth',
        })
    })
}

defineExpose({
    focus: () => textareaRef.value?.focus(),
    focusLine,
    getScrollElement: () => textareaRef.value,
})
</script>

<style scoped>
.editor-panel {
    display: flex;
    min-width: 22%;
    overflow: hidden;
    background: var(--color-surface);
    flex-direction: column;
}

.editor-textarea {
    flex: 1;
    width: 100%;
    min-height: 0;
    padding: 18px 22px;
    resize: none;
    overflow-y: auto;
    border: none;
    outline: none;
    background: #fbfdff;
    color: var(--color-text);
    font-family: "SF Mono", "JetBrains Mono", "Fira Code", "Cascadia Code", Consolas, monospace;
    font-size: 14px;
    line-height: 1.74;
    tab-size: 2;
    white-space: pre-wrap;
    word-wrap: break-word;
    caret-color: var(--color-accent);
}

.editor-textarea::placeholder {
    color: var(--color-subtle);
}

.editor-file-input {
    display: none;
}

.editor-actions {
    display: inline-flex;
    align-items: center;
    gap: 6px;
}

.editor-action-button {
    display: inline-grid;
    place-items: center;
    width: 24px;
    height: 24px;
    padding: 0;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-surface);
    color: var(--color-muted);
    cursor: pointer;
    box-shadow: 0 1px 2px rgb(15 23 42 / 4%);
    transition: transform 0.15s ease, background 0.15s ease, border-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
}

.editor-action-button:hover {
    border-color: color-mix(in srgb, var(--color-accent) 38%, #ffffff);
    background: var(--color-surface-active);
    color: var(--color-accent);
    box-shadow: 0 6px 14px rgb(15 118 110 / 12%);
    transform: translateY(-1px);
}

.editor-action-button:active {
    transform: translateY(0);
}

.editor-action-icon {
    width: 16px;
    height: 16px;
    background: currentColor;
    mask: var(--icon-url) center / contain no-repeat;
    -webkit-mask: var(--icon-url) center / contain no-repeat;
}

@media (max-width: 768px) {
    .editor-panel {
        width: 100% !important;
        height: 48%;
        border-right: none;
        border-bottom: 1px solid #d8dee4;
    }

    .editor-textarea {
        padding: 12px 14px;
        font-size: 13px;
    }
}
</style>

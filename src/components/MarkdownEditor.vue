<template>
    <section class="editor-panel" :class="{ 'is-collapsed': collapsed }" :style="{ width: normalizedWidth }">
        <div class="panel-header">
            <PanelToolbar
                context="editor"
                :files="files"
                :active-file-id="activeFileId"
                :exporting-pdf="exportingPdf"
                @select-file="$emit('select-file', $event)"
                @delete-file="$emit('delete-file', $event)"
                @create-file="$emit('create-file')"
                @clear="$emit('clear')"
                @import-file="$emit('import-file', $event)"
                @export-file="$emit('export-file')"
                @export-pdf="$emit('export-pdf')"
                @collapse-editor="$emit('collapse-editor')"
            />
        </div>

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
import PanelToolbar from './PanelToolbar.vue'

const props = defineProps({
    modelValue: {
        type: String,
        required: true
    },
    files: {
        type: Array,
        default: () => []
    },
    activeFileId: {
        type: String,
        default: ''
    },
    width: {
        type: [Number, String],
        required: true
    },
    collapsed: {
        type: Boolean,
        default: false
    },
    exportingPdf: {
        type: Boolean,
        default: false
    }
})

defineEmits([
    'update:modelValue',
    'clear',
    'scroll',
    'select-file',
    'create-file',
    'delete-file',
    'import-file',
    'export-file',
    'export-pdf',
    'collapse-editor'
])

const textareaRef = ref(null)
const normalizedWidth = computed(() => (typeof props.width === 'number' ? `${props.width}%` : props.width))

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
        'wordSpacing'
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

const focusLine = (lineNumber, { scroll = true } = {}) => {
    const textarea = textareaRef.value
    if (!textarea) return

    const line = Math.max(1, Number(lineNumber) || 1)
    const value = textarea.value
    const start = getLineStartIndex(value, line)
    const nextLineIndex = value.indexOf('\n', start)
    const end = nextLineIndex < 0 ? value.length : nextLineIndex

    textarea.focus()
    textarea.setSelectionRange(start, end)

    if (!scroll) return

    const renderedTop = getRenderedLineTop(textarea, value, start)
    requestAnimationFrame(() => {
        textarea.scrollTo({
            top: Math.max(0, renderedTop - textarea.clientHeight * 0.36),
            behavior: 'smooth'
        })
    })
}

defineExpose({
    focus: () => textareaRef.value?.focus(),
    focusLine,
    getScrollElement: () => textareaRef.value
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
    font-family: 'SF Mono', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace;
    font-size: 14px;
    line-height: 1.74;
    tab-size: 2;
    white-space: pre-wrap;
    word-wrap: break-word;
    caret-color: var(--color-accent);
    contain: layout;
}

.editor-textarea::placeholder {
    color: var(--color-subtle);
}

@media (max-width: 768px) {
    .editor-panel {
        width: 100% !important;
        height: 48%;
        border-right: none;
        border-bottom: 1px solid #d8dee4;
    }

    .editor-panel.is-collapsed {
        height: 0 !important;
        min-height: 0 !important;
        border-bottom: none;
    }

    .editor-textarea {
        padding: 12px 14px;
        font-size: 13px;
    }
}
</style>

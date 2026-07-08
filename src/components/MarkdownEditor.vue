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
                <button class="editor-action-button" type="button" title="新建文件" aria-label="新建文件" @click="$emit('create-file')">
                    <span class="editor-action-icon" :style="{ '--icon-url': `url(${newFileIcon})` }" aria-hidden="true" />
                </button>
                <button class="editor-action-button" type="button" title="清空内容" aria-label="清空内容" @click="$emit('clear')">
                    <span class="editor-action-icon" :style="{ '--icon-url': `url(${clearContentIcon})` }" aria-hidden="true" />
                </button>
            </div>
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
import clearContentIcon from '../assets/clear-content.svg'
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

defineEmits(['update:modelValue', 'clear', 'scroll', 'select-file', 'create-file', 'delete-file'])

const textareaRef = ref(null)
const normalizedWidth = computed(() => (
    typeof props.width === 'number' ? `${props.width}%` : props.width
))

defineExpose({
    focus: () => textareaRef.value?.focus(),
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

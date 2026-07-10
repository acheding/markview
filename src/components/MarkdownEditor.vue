<template>
    <section
        ref="panelRef"
        class="editor-panel"
        :class="{ 'is-collapsed': collapsed }"
        :style="{ width: normalizedWidth }"
    >
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

        <CodeMirrorEditor
            ref="editorRef"
            :model-value="modelValue"
            :search-match="searchMatch"
            @update:model-value="$emit('update:modelValue', $event)"
            @scroll="$emit('scroll')"
            @dismiss-search-highlight="$emit('dismiss-search-highlight')"
        />
    </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import CodeMirrorEditor from './CodeMirrorEditor.vue'
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
    },
    searchMatch: {
        type: Object,
        default: null
    }
})

defineEmits([
    'update:modelValue',
    'clear',
    'scroll',
    'dismiss-search-highlight',
    'select-file',
    'create-file',
    'delete-file',
    'import-file',
    'export-file',
    'export-pdf',
    'collapse-editor'
])

const panelRef = ref(null)
const editorRef = ref(null)
const normalizedWidth = computed(() => (typeof props.width === 'number' ? `${props.width}%` : props.width))

defineExpose({
    focus: (options) => editorRef.value?.focus(options),
    focusLine: (lineNumber, options) => editorRef.value?.focusLine(lineNumber, options),
    getDocumentLength: () => editorRef.value?.getDocumentLength() || 0,
    getLineTop: (lineNumber) => editorRef.value?.getLineTop(lineNumber),
    getPanelElement: () => panelRef.value,
    getScrollElement: () => editorRef.value?.getScrollElement(),
    requestMeasure: () => editorRef.value?.requestMeasure()
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
}
</style>

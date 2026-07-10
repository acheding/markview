<template>
    <div ref="editorHostRef" class="editor-surface" />
</template>

<script setup>
import { markdown } from '@codemirror/lang-markdown'
import { EditorState } from '@codemirror/state'
import { EditorView, highlightActiveLine, highlightActiveLineGutter, lineNumbers, placeholder } from '@codemirror/view'
import { minimalSetup } from 'codemirror'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { searchHighlightField, setSearchHighlight } from '../editor/searchHighlight.js'
import { findTextMatch } from '../utils/search.js'

const props = defineProps({
    modelValue: {
        type: String,
        required: true
    },
    searchMatch: {
        type: Object,
        default: null
    }
})

const emit = defineEmits(['update:modelValue', 'scroll', 'dismiss-search-highlight'])
const editorHostRef = ref(null)
let editorView = null

const getLine = (lineNumber) => {
    if (!editorView) return null

    const document = editorView.state.doc
    return document.line(Math.min(Math.max(1, Number(lineNumber) || 1), document.lines))
}

const findLineMatch = (lineNumber, query = '', matchStart) => {
    const line = getLine(lineNumber)
    if (!line) return null

    if (Number.isInteger(matchStart) && matchStart >= 0 && matchStart <= line.length) {
        const length = String(query).trim().length
        return {
            from: line.from + matchStart,
            to: Math.min(line.to, line.from + matchStart + length)
        }
    }

    const match = findTextMatch(line.text, query)
    return match ? { from: line.from + match.from, to: line.from + match.to } : { from: line.from, to: line.to }
}

const applySearchHighlight = () => {
    if (!editorView) return

    const match = props.searchMatch
    const range = match?.lineNumber ? findLineMatch(match.lineNumber, match.query, match.matchStart) : null
    setSearchHighlight(editorView, range)
}

const focus = ({ preventScroll = false } = {}) => {
    editorView?.contentDOM.focus({ preventScroll })
}

const focusLine = (lineNumber, { scroll = true, query = '', matchStart, focus: shouldFocus = true } = {}) => {
    if (!editorView) return false

    const range = findLineMatch(lineNumber, query, matchStart)
    if (!range) return false

    const transaction = {
        selection: { anchor: range.from }
    }
    if (scroll) {
        transaction.effects = EditorView.scrollIntoView(range.from, { y: 'center' })
    }
    editorView.dispatch(transaction)

    if (shouldFocus) focus({ preventScroll: !scroll })
    return true
}

const getLineTop = (lineNumber) => {
    const line = getLine(lineNumber)
    return line && editorView ? editorView.lineBlockAt(line.from).top : Number.NaN
}

const handleScroll = () => emit('scroll')

onMounted(() => {
    const state = EditorState.create({
        doc: props.modelValue,
        extensions: [
            minimalSetup,
            lineNumbers(),
            highlightActiveLine(),
            highlightActiveLineGutter(),
            markdown(),
            EditorView.lineWrapping,
            placeholder('在此输入 Markdown 内容...'),
            searchHighlightField,
            EditorView.contentAttributes.of({
                'aria-label': 'Markdown 编辑器',
                spellcheck: 'false'
            }),
            EditorView.domEventHandlers({
                pointerdown: () => {
                    emit('dismiss-search-highlight')
                    return false
                }
            }),
            EditorView.updateListener.of((update) => {
                if (update.docChanged) {
                    const value = update.state.doc.toString()
                    if (value !== props.modelValue) emit('update:modelValue', value)
                }

                const hasUserSelection =
                    update.selectionSet && update.transactions.some((transaction) => transaction.isUserEvent('select'))
                const hasUserEdit =
                    update.docChanged && update.transactions.some((transaction) => transaction.isUserEvent('input'))
                if (hasUserSelection || hasUserEdit) emit('dismiss-search-highlight')
            })
        ]
    })

    editorView = new EditorView({ state, parent: editorHostRef.value })
    editorView.scrollDOM.addEventListener('scroll', handleScroll, { passive: true })
    applySearchHighlight()
})

watch(
    () => props.modelValue,
    (value) => {
        if (!editorView || value === editorView.state.doc.toString()) return

        // 外部切换文档时整段替换内容，同时把光标限制在新文档范围内。
        const anchor = Math.min(editorView.state.selection.main.anchor, value.length)
        editorView.dispatch({
            changes: { from: 0, to: editorView.state.doc.length, insert: value },
            selection: { anchor }
        })
    }
)

watch(() => props.searchMatch, applySearchHighlight, { deep: true })

onBeforeUnmount(() => {
    editorView?.scrollDOM.removeEventListener('scroll', handleScroll)
    editorView?.destroy()
    editorView = null
})

defineExpose({
    focus,
    focusLine,
    getDocumentLength: () => editorView?.state.doc.length || 0,
    getLineTop,
    getScrollElement: () => editorView?.scrollDOM,
    requestMeasure: () => editorView?.requestMeasure()
})
</script>

<style scoped>
.editor-surface {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    background: #fbfdff;
}

.editor-surface :deep(.cm-editor) {
    height: 100%;
    background: #fbfdff;
    color: var(--color-text);
    font-size: 14px;
}

.editor-surface :deep(.cm-editor.cm-focused) {
    outline: none;
}

.editor-surface :deep(.cm-scroller) {
    overflow: auto;
    font-family: 'SF Mono', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace;
    line-height: 1.74;
}

.editor-surface :deep(.cm-content) {
    min-height: 100%;
    padding: 18px 0;
    caret-color: var(--color-accent);
}

.editor-surface :deep(.cm-line) {
    padding: 0 16px;
}

.editor-surface :deep(.cm-gutters) {
    border-right: 1px solid var(--color-border-soft);
    background: var(--color-surface-soft);
    color: var(--color-subtle);
}

.editor-surface :deep(.cm-activeLine),
.editor-surface :deep(.cm-activeLineGutter) {
    background: color-mix(in srgb, var(--color-accent-soft) 24%, transparent);
}

.editor-surface :deep(.cm-selectionBackground),
.editor-surface :deep(.cm-content ::selection) {
    background: color-mix(in srgb, var(--color-accent-soft) 72%, transparent) !important;
}

.editor-surface :deep(.cm-search-highlight) {
    border-radius: 3px;
    background: var(--color-search-highlight);
    color: var(--color-search-highlight-text);
}

@media (max-width: 768px) {
    .editor-surface :deep(.cm-editor) {
        font-size: 13px;
    }

    .editor-surface :deep(.cm-content) {
        padding: 12px 0;
    }

    .editor-surface :deep(.cm-line) {
        padding: 0 12px;
    }
}
</style>

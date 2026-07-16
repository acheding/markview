import { EditorView } from '@codemirror/view'

// CodeMirror 主题：把原先散落在组件 scoped :deep(.cm-*) 里的样式统一为 EditorView.theme。
// 所有取值引用 CSS token 变量，视觉与旧版一致；响应式由 tokens.css 的媒体查询改变量实现。
export const editorTheme = EditorView.theme({
    '&': {
        height: '100%',
        background: 'var(--color-surface)',
        color: 'var(--color-text)',
        fontSize: 'var(--editor-font-size)'
    },
    '&.cm-focused': {
        outline: 'none'
    },
    '.cm-scroller': {
        overflow: 'auto',
        fontFamily: 'var(--font-mono)',
        lineHeight: 'var(--editor-line-height)'
    },
    '.cm-content': {
        minHeight: '100%',
        padding: 'var(--editor-content-padding-y) 0',
        caretColor: 'var(--color-accent)'
    },
    '.cm-line': {
        padding: '0 var(--editor-line-padding-x)'
    },
    '.cm-gutters': {
        borderRight: '1px solid var(--color-border-soft)',
        background: 'var(--color-surface-soft)',
        color: 'var(--color-subtle)'
    },
    '.cm-activeLine, .cm-activeLineGutter': {
        background: 'color-mix(in srgb, var(--color-accent-soft) 42%, transparent)'
    },
    '.cm-selectionBackground, .cm-content ::selection': {
        background: 'var(--color-selection) !important'
    },
    '.cm-search-highlight': {
        borderRadius: '3px',
        background: 'var(--color-search-highlight)',
        color: 'var(--color-search-highlight-text)'
    },
    '.cm-tooltip.cm-tooltip-autocomplete': {
        overflow: 'hidden',
        border: '1px solid var(--color-border-soft)',
        borderRadius: 'var(--radius-lg)',
        background: 'var(--color-surface)',
        color: 'var(--color-text)',
        boxShadow: 'var(--shadow-menu)',
        fontFamily: 'var(--font-sans)'
    },
    '.cm-tooltip.cm-tooltip-autocomplete > ul': {
        maxWidth: 'min(480px, 72vw)',
        maxHeight: '280px',
        padding: 'var(--space-3)'
    },
    '.cm-tooltip.cm-tooltip-autocomplete > ul > li': {
        display: 'flex',
        alignItems: 'center',
        minHeight: '34px',
        gap: 'var(--space-3)',
        padding: '6px 10px',
        borderRadius: 'var(--radius-md)',
        lineHeight: '20px'
    },
    '.cm-tooltip.cm-tooltip-autocomplete > ul > li + li': {
        marginTop: 'var(--space-1)'
    },
    '.cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]': {
        background: 'var(--color-surface-active)',
        color: 'var(--color-accent-strong)'
    },
    '.cm-completionLabel': {
        fontFamily: 'var(--font-mono)'
    },
    '.cm-completionIcon': {
        flexShrink: '0'
    },
    '.cm-completionDetail': {
        marginLeft: 'auto',
        color: 'var(--color-subtle)',
        fontStyle: 'normal'
    },
    '.cm-completionMatchedText': {
        color: 'var(--color-accent-strong)',
        textDecoration: 'none',
        fontWeight: '700'
    }
})

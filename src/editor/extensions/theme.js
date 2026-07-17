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
    // —— 查找替换面板（@codemirror/search）——
    '.cm-panels': {
        background: 'var(--color-surface-soft)',
        color: 'var(--color-text)'
    },
    '.cm-panels.cm-panels-top': {
        borderBottom: '1px solid var(--color-border-soft)'
    },
    '.cm-panel.cm-search': {
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 'var(--space-3) var(--space-4)',
        padding: 'var(--space-4) var(--space-10) var(--space-4) var(--space-6)',
        fontFamily: 'var(--font-sans)',
        fontSize: 'var(--font-size-sm)'
    },
    '.cm-panel.cm-search .cm-textfield': {
        width: 'clamp(96px, 14em, 40%)',
        padding: '3px 8px',
        border: '1px solid var(--color-border-soft)',
        borderRadius: 'var(--radius-md)',
        background: 'var(--color-surface)',
        color: 'var(--color-text)',
        fontSize: 'var(--font-size-sm)'
    },
    '.cm-panel.cm-search .cm-textfield:focus': {
        outline: 'none',
        borderColor: 'var(--color-accent)'
    },
    '.cm-panel.cm-search .cm-button': {
        padding: '3px 10px',
        border: '1px solid var(--color-border-soft)',
        borderRadius: 'var(--radius-md)',
        background: 'var(--color-surface)',
        backgroundImage: 'none',
        color: 'var(--color-text)',
        fontSize: 'var(--font-size-sm)',
        cursor: 'pointer'
    },
    '.cm-panel.cm-search .cm-button:hover': {
        background: 'var(--color-surface-active)'
    },
    '.cm-panel.cm-search label': {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        color: 'var(--color-muted)',
        fontSize: 'var(--font-size-sm)'
    },
    '.cm-panel.cm-search input[type="checkbox"]': {
        margin: '0',
        accentColor: 'var(--color-accent)'
    },
    '.cm-panel.cm-search button[name="close"]': {
        position: 'absolute',
        top: '50%',
        right: 'var(--space-4)',
        transform: 'translateY(-50%)',
        padding: '0 var(--space-3)',
        border: 'none',
        background: 'transparent',
        color: 'var(--color-muted)',
        fontSize: 'var(--font-size-lg)',
        cursor: 'pointer'
    },
    '.cm-panel.cm-search button[name="close"]:hover': {
        color: 'var(--color-text)'
    },
    // 面板检索的命中：普通命中用淡色底，当前命中沿用全局搜索的高亮 token。
    '.cm-searchMatch': {
        borderRadius: '3px',
        background: 'color-mix(in srgb, var(--color-search-highlight) 40%, transparent)'
    },
    '.cm-searchMatch.cm-searchMatch-selected': {
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

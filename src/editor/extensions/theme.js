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
    // —— 查找替换面板（自定义 DOM，见 extensions/searchPanel.js）——
    // 面板容器改为绝对定位悬浮在编辑区右上角（覆盖基础样式的 sticky + 左右铺满），
    // 不占布局空间、不推开编辑内容；视觉是贴顶的悬浮小部件（下圆角 + 投影）。
    '.cm-panels': {
        position: 'absolute',
        top: '0',
        left: 'auto',
        right: '14px',
        width: 'max-content',
        maxWidth: 'calc(100% - 28px)',
        border: '1px solid var(--color-border-soft)',
        borderTop: 'none',
        borderRadius: '0 0 var(--radius-lg) var(--radius-lg)',
        background: 'var(--color-surface)',
        color: 'var(--color-text)',
        boxShadow: 'var(--shadow-menu)',
        // CodeMirror 基础样式给的 300 会盖住全局 tooltip 气泡（z=100）；
        // 面板只需压住编辑区滚动内容，压到 2 即可。
        zIndex: '2'
    },
    // grid 两列：输入框列（查询/替换等宽对齐）+ 动作列（至少容下整行按钮、
    // 富余时撑满剩余宽度，关闭按钮借 auto margin 贴到面板右缘）。
    '.cm-panel.mv-search': {
        display: 'grid',
        gridTemplateColumns: 'minmax(150px, 230px) max-content',
        alignItems: 'center',
        gap: 'var(--space-2) var(--space-3)',
        padding: 'var(--space-3) var(--space-4)',
        fontFamily: 'var(--font-sans)',
        fontSize: 'var(--font-size-sm)'
    },
    '.mv-search__actions': {
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-3)'
    },
    // 查询 / 替换共用的输入框容器：开关与计数内嵌其中，聚焦时整体点亮。
    '.mv-search__field': {
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-1)',
        height: '26px',
        padding: '0 var(--space-2) 0 var(--space-4)',
        border: '1px solid var(--color-border-soft)',
        borderRadius: 'var(--radius-md)',
        background: 'var(--color-surface)',
        transition: 'border-color var(--duration-fast) ease, box-shadow var(--duration-fast) ease'
    },
    // 极窄面板（移动端纵向布局）退化为单列：动作行跟在对应输入框之下。
    '@media (max-width: 520px)': {
        '.cm-panel.mv-search': {
            gridTemplateColumns: 'minmax(0, 1fr)'
        }
    },
    '.mv-search__field:focus-within': {
        borderColor: 'var(--color-accent)',
        boxShadow: '0 0 0 2px var(--color-accent-soft)'
    },
    // 不设高度：让输入框按文字内容自适应，由容器的 align-items:center 精确垂直居中。
    '.mv-search__input': {
        flex: '1',
        minWidth: '0',
        padding: '0',
        border: 'none',
        outline: 'none',
        background: 'transparent',
        color: 'var(--color-text)',
        fontFamily: 'inherit',
        fontSize: 'var(--font-size-sm)',
        lineHeight: 'normal'
    },
    '.mv-search__input::placeholder': {
        color: 'var(--color-subtle)'
    },
    '.mv-search__count': {
        flexShrink: '0',
        padding: '0 var(--space-2)',
        color: 'var(--color-subtle)',
        fontVariantNumeric: 'tabular-nums',
        whiteSpace: 'nowrap'
    },
    '.mv-search__count.is-empty': {
        color: 'var(--color-danger)'
    },
    // 内嵌开关（Aa / 词 / .*）：激活时以强调色底 + 描边点亮。
    '.mv-search__toggle': {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: '0',
        width: '20px',
        height: '20px',
        padding: '0',
        border: '1px solid transparent',
        borderRadius: 'var(--radius-sm)',
        background: 'transparent',
        color: 'var(--color-muted)',
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--font-size-xs)',
        lineHeight: '1',
        cursor: 'pointer',
        transition:
            'background var(--duration-fast) ease, color var(--duration-fast) ease, border-color var(--duration-fast) ease'
    },
    '.mv-search__toggle:hover': {
        background: 'var(--color-surface-active)',
        color: 'var(--color-text)'
    },
    // 全字匹配开关：对齐 VS Code 的「ab + 下划线」图标观感。
    '.mv-search__toggle[name="word"]': {
        textDecoration: 'underline',
        textUnderlineOffset: '2px'
    },
    '.mv-search__toggle[aria-pressed="true"]': {
        border: '1px solid color-mix(in srgb, var(--color-accent) 45%, transparent)',
        background: 'var(--color-accent-soft)',
        color: 'var(--color-accent-strong)'
    },
    '.mv-search__btn': {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-2)',
        flexShrink: '0',
        height: '24px',
        padding: '0 var(--space-4)',
        border: '1px solid var(--color-border-soft)',
        borderRadius: 'var(--radius-md)',
        background: 'var(--color-surface)',
        color: 'var(--color-text)',
        fontSize: 'var(--font-size-sm)',
        lineHeight: '1',
        cursor: 'pointer',
        transition:
            'background var(--duration-fast) ease, color var(--duration-fast) ease, border-color var(--duration-fast) ease, opacity var(--duration-fast) ease'
    },
    '.mv-search__btn:hover:not(:disabled)': {
        borderColor: 'var(--color-border)',
        background: 'var(--color-surface-active)'
    },
    '.mv-search__btn:disabled': {
        opacity: '0.45',
        cursor: 'default'
    },
    '.mv-search__btn--icon': {
        width: '24px',
        padding: '0'
    },
    // 关闭按钮：常态即着色区别于普通按钮，hover 转危险色底，保证显眼。
    '.mv-search__btn.mv-search__close': {
        marginLeft: 'auto',
        border: '1px solid transparent',
        background: 'transparent',
        color: 'var(--color-muted)'
    },
    '.mv-search__btn.mv-search__close:hover:not(:disabled)': {
        borderColor: 'transparent',
        background: 'var(--color-danger-soft)',
        color: 'var(--color-danger)'
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

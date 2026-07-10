import { LanguageDescription, LanguageSupport, StreamLanguage } from '@codemirror/language'

const language = (name, alias, extensions, load) =>
    LanguageDescription.of({
        name,
        alias,
        extensions,
        load
    })

const loadJavaScript = (config) => () =>
    import('@codemirror/lang-javascript').then(({ javascript }) => javascript(config))

export const markdownCodeLanguages = [
    language('JavaScript', ['js', 'javascript', 'node'], ['js', 'mjs', 'cjs'], loadJavaScript()),
    language('JSX', ['jsx'], ['jsx'], loadJavaScript({ jsx: true })),
    language('TypeScript', ['ts', 'typescript'], ['ts', 'mts', 'cts'], loadJavaScript({ typescript: true })),
    language('TSX', ['tsx'], ['tsx'], loadJavaScript({ jsx: true, typescript: true })),
    language('CSS', ['css'], ['css'], () => import('@codemirror/lang-css').then(({ css }) => css())),
    language('HTML', ['html', 'vue'], ['html', 'htm', 'vue'], () =>
        import('@codemirror/lang-html').then(({ html }) => html())
    ),
    language('XML', ['xml'], ['xml'], () => import('@codemirror/lang-xml').then(({ xml }) => xml())),
    language('JSON', ['json'], ['json'], () => import('@codemirror/lang-json').then(({ json }) => json())),
    language('Python', ['py', 'python'], ['py'], () =>
        import('@codemirror/lang-python').then(({ python }) => python())
    ),
    language('Shell', ['bash', 'sh', 'shell', 'zsh'], ['sh', 'bash', 'zsh'], () =>
        import('@codemirror/legacy-modes/mode/shell').then(
            ({ shell }) => new LanguageSupport(StreamLanguage.define(shell))
        )
    ),
    language('Markdown', ['md', 'markdown'], ['md', 'markdown'], () =>
        import('@codemirror/lang-markdown').then(({ markdown }) => markdown())
    )
]

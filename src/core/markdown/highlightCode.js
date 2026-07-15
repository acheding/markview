import { escapeHtml } from '../text.js'

// highlight.js 及各语言按需异步加载：无代码块的文档首次预览不必下载这部分体积。
// 加载完成后缓存实例；调用方需在渲染前先 await loadHighlighter，highlightCode 本身保持同步。
let hljs = null
let hljsPromise = null

export const loadHighlighter = () => {
    if (hljs) return Promise.resolve(hljs)
    if (!hljsPromise) {
        hljsPromise = Promise.all([
            import('highlight.js/lib/core'),
            import('highlight.js/lib/languages/bash'),
            import('highlight.js/lib/languages/css'),
            import('highlight.js/lib/languages/javascript'),
            import('highlight.js/lib/languages/json'),
            import('highlight.js/lib/languages/markdown'),
            import('highlight.js/lib/languages/python'),
            import('highlight.js/lib/languages/typescript'),
            import('highlight.js/lib/languages/xml')
        ]).then(([core, bash, css, javascript, json, markdown, python, typescript, xml]) => {
            const instance = core.default
            // 按需注册语言，控制打包体积。
            instance.registerLanguage('bash', bash.default)
            instance.registerLanguage('css', css.default)
            instance.registerLanguage('html', xml.default)
            instance.registerLanguage('javascript', javascript.default)
            instance.registerLanguage('json', json.default)
            instance.registerLanguage('markdown', markdown.default)
            instance.registerLanguage('python', python.default)
            instance.registerLanguage('typescript', typescript.default)
            instance.registerLanguage('xml', xml.default)
            hljs = instance
            return hljs
        })
    }
    return hljsPromise
}

export const highlightCode = (code, language) => {
    // 理论上渲染前已 await loadHighlighter；未就绪时退化为转义原文，避免抛错。
    if (!hljs) return escapeHtml(code)

    if (language && hljs.getLanguage(language)) {
        return hljs.highlight(code, { language }).value
    }

    return hljs.highlightAuto(code).value
}

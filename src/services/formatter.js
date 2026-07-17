// Markdown 格式化服务：Prettier standalone 及插件全部走动态 import，
// Vite 拆成独立异步 chunk，首次调用「格式化文档」才下载，主包体积零增长。
// 插件覆盖:markdown 本体、front matter(yaml)、代码块 js/json(babel+estree)、css(postcss)、html;
// 其余语言(python、mermaid 等)Prettier 不认识,代码块原样保留、不会被破坏。
let enginePromise = null

const loadEngine = () => {
    if (!enginePromise) {
        enginePromise = Promise.all([
            import('prettier/standalone'),
            import('prettier/plugins/markdown'),
            import('prettier/plugins/yaml'),
            import('prettier/plugins/babel'),
            import('prettier/plugins/estree'),
            import('prettier/plugins/postcss'),
            import('prettier/plugins/html')
        ]).then(([standalone, ...plugins]) => ({ formatWithCursor: standalone.formatWithCursor, plugins }))
        // 加载失败（如离线时 chunk 拉取失败）不缓存 rejected promise，下次调用可重试。
        enginePromise.catch(() => {
            enginePromise = null
        })
    }
    return enginePromise
}

/**
 * 格式化整篇 Markdown（含受支持语言的围栏代码块），并把光标位置映射到格式化后的文本。
 * proseWrap 固定 preserve：只规范结构（表格对齐、列表符号、空行等），不重排正文换行，
 * 中文段落不会被折行打乱。
 *
 * @param {string} text
 * @param {number} cursorOffset 当前光标在 text 中的偏移
 * @returns {Promise<{ formatted: string, cursorOffset: number }>}
 */
export const formatMarkdown = async (text, cursorOffset = 0) => {
    const { formatWithCursor, plugins } = await loadEngine()
    const result = await formatWithCursor(text, {
        parser: 'markdown',
        plugins,
        proseWrap: 'preserve',
        cursorOffset: Math.max(0, Math.min(Math.trunc(cursorOffset) || 0, text.length))
    })
    return { formatted: result.formatted, cursorOffset: result.cursorOffset }
}

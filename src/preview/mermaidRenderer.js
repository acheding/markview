// Mermaid SVG 生产器：按需加载、按主题和源码缓存，并串行保护全局 initialize + render。
let mermaidPromise = null
const loadMermaid = () => {
    if (!mermaidPromise) {
        mermaidPromise = import('mermaid').then((mod) => mod.default)
    }
    return mermaidPromise
}

const cache = new Map()
let renderSeq = 0
let renderQueue = Promise.resolve()

const cacheKey = (code, theme) => `${theme === 'dark' ? 'dark' : 'default'}\n${code}`

// 供调用方区分「首次渲染」与「缓存命中」：前者值得做一次出现动画，后者是编辑期间的重发布，不该重放。
export const hasMermaidSvgCached = (code, theme = 'light') => cache.has(cacheKey(code, theme))

export const renderMermaidSvg = (code, theme = 'light') => {
    const mermaidTheme = theme === 'dark' ? 'dark' : 'default'
    const key = cacheKey(code, theme)
    if (cache.has(key)) return Promise.resolve(cache.get(key))

    const render = renderQueue.then(async () => {
        if (cache.has(key)) return cache.get(key)

        const mermaid = await loadMermaid()
        // suppressErrorRendering：解析失败时只抛异常，不让 mermaid 往页面 DOM 里注入它自带的大幅报错 SVG，
        // 错误展示统一交给 preparePreviewHtml 的 mermaid-error 块。
        mermaid.initialize({
            startOnLoad: false,
            securityLevel: 'strict',
            suppressErrorRendering: true,
            theme: mermaidTheme
        })
        const { svg } = await mermaid.render(`mmd-${(renderSeq += 1)}`, code)
        cache.set(key, svg)
        return svg
    })

    renderQueue = render.catch(() => undefined)
    return render
}

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

export const renderMermaidSvg = (code, theme = 'light') => {
    const mermaidTheme = theme === 'dark' ? 'dark' : 'default'
    const key = `${mermaidTheme}\n${code}`
    if (cache.has(key)) return Promise.resolve(cache.get(key))

    const render = renderQueue.then(async () => {
        if (cache.has(key)) return cache.get(key)

        const mermaid = await loadMermaid()
        mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: mermaidTheme })
        const { svg } = await mermaid.render(`mmd-${(renderSeq += 1)}`, code)
        cache.set(key, svg)
        return svg
    })

    renderQueue = render.catch(() => undefined)
    return render
}

import { escapeHtml } from '../core/text.js'

// 预览区 Mermaid 渲染：按需动态加载 mermaid（体积大，仅当文档含图表时才加载），
// 按「主题 + 源码」缓存 SVG，避免实时编辑时重复编译。渲染是异步 DOM 副作用，故置于 preview 层。
let mermaidPromise = null
const loadMermaid = () => {
    if (!mermaidPromise) {
        mermaidPromise = import('mermaid').then((mod) => mod.default)
    }
    return mermaidPromise
}

const cache = new Map()
let renderSeq = 0

export const renderMermaidDiagrams = async (contentEl, theme = 'light') => {
    const blocks = contentEl.querySelectorAll('.mermaid-block')
    if (!blocks.length) return

    const mermaid = await loadMermaid()
    const mermaidTheme = theme === 'dark' ? 'dark' : 'default'
    mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: mermaidTheme })

    for (const block of blocks) {
        if (!block.isConnected) continue

        // 首次渲染前把源码固化到 data-code：渲染后 textContent 会变成 SVG，重渲（如切主题）需从此读取。
        const code = block.dataset.code ?? block.textContent ?? ''
        if (block.dataset.code === undefined) block.dataset.code = code

        const key = `${mermaidTheme}\n${code}`
        if (cache.has(key)) {
            block.innerHTML = cache.get(key)
            continue
        }

        try {
            const { svg } = await mermaid.render(`mmd-${(renderSeq += 1)}`, code)
            cache.set(key, svg)
            if (block.isConnected) block.innerHTML = svg
        } catch (error) {
            if (block.isConnected) {
                block.innerHTML = `<pre class="mermaid-error">Mermaid 渲染失败：${escapeHtml(error?.message || String(error))}</pre>`
            }
        }
    }
}

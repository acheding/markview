import { escapeHtml } from '../core/text.js'
import { renderMermaidSvg } from './mermaidRenderer.js'

const MERMAID_MARKER = 'class="mermaid-block"'
const KATEX_MARKER = 'class="katex'

const createTemplate = (html) => {
    const template = document.createElement('template')
    template.innerHTML = html
    return template
}

// KaTeX 样式改为按需注入：仅当预览实际含公式时才加载 katex.min.css（缓存，仅注入一次）。
// 与 mathExtension 的 JS 懒加载配套，让无公式文档的首屏彻底不碰这份较大的样式表。
let katexCssPromise = null
const ensureKatexCss = () => {
    if (!katexCssPromise) {
        katexCssPromise = import('katex/dist/katex.min.css').catch(() => {})
    }
    return katexCssPromise
}

// 在离屏 template 中完成 Mermaid 组装，调用方只会拿到具有最终几何尺寸的完整 HTML。
export const preparePreviewHtml = async (
    html,
    theme,
    { createTemplateElement = createTemplate, renderSvg = renderMermaidSvg } = {}
) => {
    const source = String(html || '')

    // 含公式即触发样式注入（不阻塞返回，CSS 加载与 DOM 渲染并行）。
    if (source.includes(KATEX_MARKER)) ensureKatexCss()

    if (!source.includes(MERMAID_MARKER)) return html

    const template = createTemplateElement(html)
    const blocks = template.content.querySelectorAll('.mermaid-block')

    for (const block of blocks) {
        const code = block.textContent ?? ''
        try {
            block.innerHTML = await renderSvg(code, theme)
        } catch (error) {
            block.innerHTML = `<pre class="mermaid-error">Mermaid 渲染失败：${escapeHtml(error?.message || String(error))}</pre>`
        }
    }

    return template.innerHTML
}

import { escapeHtml } from '../core/text.js'
import { renderMermaidSvg } from './mermaidRenderer.js'

const MERMAID_MARKER = 'class="mermaid-block"'

const createTemplate = (html) => {
    const template = document.createElement('template')
    template.innerHTML = html
    return template
}

// 在离屏 template 中完成 Mermaid 组装，调用方只会拿到具有最终几何尺寸的完整 HTML。
export const preparePreviewHtml = async (
    html,
    theme,
    { createTemplateElement = createTemplate, renderSvg = renderMermaidSvg } = {}
) => {
    if (!String(html || '').includes(MERMAID_MARKER)) return html

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

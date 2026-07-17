import { escapeHtml } from '../core/text.js'
import { hasMermaidSvgCached, renderMermaidSvg } from './mermaidRenderer.js'

export const MERMAID_MARKER = 'class="mermaid-block"'
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
    { createTemplateElement = createTemplate, renderSvg = renderMermaidSvg, hasCachedSvg = hasMermaidSvgCached } = {}
) => {
    const source = String(html || '')

    // 含公式即触发样式注入（不阻塞返回，CSS 加载与 DOM 渲染并行）。
    if (source.includes(KATEX_MARKER)) ensureKatexCss()

    if (!source.includes(MERMAID_MARKER)) return html

    const template = createTemplateElement(html)
    const blocks = template.content.querySelectorAll('.mermaid-block')

    for (const block of blocks) {
        const code = block.textContent ?? ''

        // 刚敲下 ```mermaid 还没写内容时源码为空，送去渲染必报错（还会白白拉起 mermaid 库），
        // 显示轻量等待提示即可。
        if (!code.trim()) {
            block.innerHTML = '<p class="mermaid-empty">等待图表内容…</p>'
            continue
        }

        // 渲染前先记下是否命中缓存：首次渲染的图表打上 --fresh，发布后做一次淡入；
        // 编辑期间的重发布（缓存命中）不打标，避免每次按键都让所有图表重放动画。
        const isFresh = !hasCachedSvg(code, theme)
        try {
            block.innerHTML = await renderSvg(code, theme)
            if (isFresh) block.classList?.add('mermaid-block--fresh')
        } catch (error) {
            // 围栏尚未闭合时，后续正文会被整段吞进源码，mermaid 识别不出图表类型（UnknownDiagramError）。
            // 这种「还不是图」的输入中间态按等待处理；只有已识别出类型的真实语法错误才展示错误块。
            const unknownType =
                error?.name === 'UnknownDiagramError' || /no diagram type detected/i.test(error?.message || '')
            block.innerHTML = unknownType
                ? '<p class="mermaid-empty">等待图表内容…</p>'
                : `<pre class="mermaid-error">Mermaid 渲染失败：${escapeHtml(error?.message || String(error))}</pre>`
        }
    }

    return template.innerHTML
}

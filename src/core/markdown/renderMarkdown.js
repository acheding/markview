import { Marked } from 'marked'
import { escapeHtml, stripHtml } from '../text.js'
import { highlightCode, loadHighlighter } from './highlightCode.js'
import { mathExtensions, mathRenderers, loadKatex } from './mathExtension.js'
import { createSlugger } from './slugger.js'

// 独立 Marked 实例承载 KaTeX 数学扩展（$…$ / $$…$$）。
// 注意：不能用全局 marked.use + marked.lexer(src, options)——显式传 options 会覆盖已注册的扩展。
const markdownParser = new Marked({ breaks: true, gfm: true })
markdownParser.use({ extensions: mathExtensions })

const getLanguage = (infoString = '') => infoString.trim().split(/\s+/)[0]

// 递归遍历 token 树，判断本次渲染实际需要哪些重依赖：
//   - 非 mermaid 的代码块 → highlight.js
//   - 行内 / 块级公式        → KaTeX
// 无对应内容时就不加载，避免首次预览白白下载 katex / hljs。
const scanRenderNeeds = (tokens, needs = { hljs: false, katex: false }) => {
    for (const token of tokens) {
        if (needs.hljs && needs.katex) return needs

        if (token.type === 'code') {
            if (getLanguage(token.lang) !== 'mermaid') needs.hljs = true
        } else if (token.type === 'inlineMath' || token.type === 'blockMath') {
            needs.katex = true
        }

        // 子 token 分布在不同字段：inline/block 子节点、列表项、表头、表体单元格。
        if (token.tokens) scanRenderNeeds(token.tokens, needs)
        if (token.items) scanRenderNeeds(token.items, needs)
        if (token.header) scanRenderNeeds(token.header, needs)
        if (token.rows) token.rows.forEach((row) => scanRenderNeeds(row, needs))
    }
    return needs
}
const SOURCE_LINE_TYPES = new Set([
    'blockquote',
    'blockMath',
    'code',
    'heading',
    'html',
    'hr',
    'list',
    'paragraph',
    'table'
])

const countLines = (text) => (text.match(/\n/g) || []).length

const getSourceLineAttr = (token) =>
    Number.isFinite(token?.sourceLine) ? ` data-source-line="${token.sourceLine}"` : ''

const getCellAlignAttr = (align) => (align ? ` style="text-align:${align}"` : '')

const createTitleAttr = (title) => (title ? ` title="${escapeHtml(title)}"` : '')

const isSafeUrl = (
    value = '',
    { allowDataImage = false, allowedProtocols = ['http', 'https', 'mailto', 'tel'] } = {}
) => {
    const url = String(value || '').trim()
    if (!url) return false

    // eslint-disable-next-line no-control-regex
    const compactUrl = url.replace(/[\u0000-\u001F\u007F\s]+/g, '')
    const protocolMatch = compactUrl.match(/^([a-zA-Z][a-zA-Z\d+.-]*):/)
    if (!protocolMatch) return true

    const protocol = protocolMatch[1].toLowerCase()
    if (allowedProtocols.includes(protocol)) return true

    return (
        allowDataImage &&
        protocol === 'data' &&
        /^data:image\/(?:png|gif|jpe?g|webp);base64,[a-z0-9+/]+=*$/i.test(compactUrl)
    )
}

const getSafeUrlAttr = (href, options) => (isSafeUrl(href, options) ? escapeHtml(String(href || '').trim()) : '')

// 用 token.raw 在源文中定位块级 token 的起始行，输出 data-source-line。
// 该属性是「编辑区行号 ↔ 预览 DOM」的唯一粘合契约，滚动同步与搜索定位都依赖它。
const annotateSourceLines = (tokens, source) => {
    let cursorIndex = 0
    let cursorLine = 1

    tokens.forEach((token) => {
        if (!token.raw) return

        const tokenIndex = source.indexOf(token.raw, cursorIndex)
        if (tokenIndex < 0) return

        cursorLine += countLines(source.slice(cursorIndex, tokenIndex))

        if (SOURCE_LINE_TYPES.has(token.type)) {
            token.sourceLine = cursorLine
        }
        if (token.type === 'list') annotateListItemLines(token)

        cursorIndex = tokenIndex + token.raw.length
        cursorLine += countLines(token.raw)
    })
}

// 给列表项标注起始源码行（任务列表勾选回写依赖它定位要改写的行）。
// 同一层级里 item.raw 是 list.raw 的逐段原文切片，可用 indexOf 精确定位；
// 行数在 marked 的各种 raw 变换（去缩进等）下保持不变，按换行数推进行号即可。
const annotateListItemLines = (listToken) => {
    if (!Number.isFinite(listToken.sourceLine)) return

    let cursorIndex = 0
    let cursorLine = listToken.sourceLine
    for (const item of listToken.items) {
        if (!item.raw) continue

        const itemIndex = listToken.raw.indexOf(item.raw, cursorIndex)
        if (itemIndex < 0) continue

        cursorLine += countLines(listToken.raw.slice(cursorIndex, itemIndex))
        item.sourceLine = cursorLine
        annotateNestedListLines(item)

        cursorIndex = itemIndex + item.raw.length
        cursorLine += countLines(item.raw)
    }
}

// 列表项内的嵌套列表：其 raw 被 marked 逐行去除了父级缩进，无法直接 indexOf，
// 改用「首行内容去缩进后精确相等」在 item.raw 的行中定位起始行——若某行去掉缩进后
// 与嵌套列表首行完全一致，它本就会被解析成列表，故不会误中普通文字行。
const annotateNestedListLines = (item) => {
    if (!Number.isFinite(item.sourceLine)) return

    const itemLines = item.raw.split('\n')
    // 嵌套列表不可能位于列表项自身的首行，从第二行起找。
    let searchFrom = 1
    for (const child of item.tokens || []) {
        if (child.type !== 'list' || !child.raw) continue

        const childFirstLine = child.raw.split('\n', 1)[0].trim()
        const lineOffset = itemLines.findIndex((text, index) => index >= searchFrom && text.trim() === childFirstLine)
        if (lineOffset < 0) continue

        child.sourceLine = item.sourceLine + lineOffset
        searchFrom = lineOffset + 1
        annotateListItemLines(child)
    }
}

export const renderMarkdown = async (source) => {
    const toc = []

    if (!source.trim()) {
        return {
            html: '<div class="empty-hint">在左侧编辑区输入 Markdown，右侧将实时预览</div>',
            toc
        }
    }

    try {
        const slug = createSlugger()
        // 不传 options：用实例配置（breaks/gfm + 数学扩展），否则会覆盖已注册的扩展。
        const tokens = markdownParser.lexer(source)
        annotateSourceLines(tokens, source)

        // marked 的 renderer 必须同步返回字符串，无法在其中 await；
        // 故在 parse 前先按 token 需求预加载重依赖，加载好后再走同步渲染。
        const needs = scanRenderNeeds(tokens)
        await Promise.all([needs.hljs ? loadHighlighter() : null, needs.katex ? loadKatex() : null])

        const extensions = {
            renderers: {
                heading(token) {
                    const text = this.parser.parseInline(token.tokens)
                    const id = slug(token.text)
                    const title = stripHtml(text || token.text)
                    toc.push({ id, title, level: token.depth, sourceLine: token.sourceLine })

                    return `<h${token.depth} id="${escapeHtml(id)}"${getSourceLineAttr(token)}><a class="heading-anchor" href="#${escapeHtml(id)}" aria-hidden="true">#</a>${text}</h${token.depth}>`
                },

                paragraph(token) {
                    return `<p${getSourceLineAttr(token)}>${this.parser.parseInline(token.tokens)}</p>`
                },

                blockquote(token) {
                    return `<blockquote${getSourceLineAttr(token)}>${this.parser.parse(token.tokens)}</blockquote>`
                },

                html(token) {
                    const text = escapeHtml(token.text || token.raw || '')

                    return token.block ? `<p${getSourceLineAttr(token)}>${text}</p>` : text
                },

                code(token) {
                    const language = getLanguage(token.lang)

                    // mermaid：不做语法高亮，输出占位块，源码作为文本子节点，由预览层异步渲染成图。
                    if (language === 'mermaid') {
                        return `<div class="mermaid-block"${getSourceLineAttr(token)}>${escapeHtml(token.text)}</div>`
                    }

                    const languageClass = language ? ` language-${escapeHtml(language)}` : ''
                    const langBadge = language ? `<span class="code-block__lang">${escapeHtml(language)}</span>` : ''

                    // 外层 .code-block 承载 data-source-line（块级容器），并为角标 / 复制按钮提供定位上下文。
                    // 复制按钮无 data-*，点击时由预览层取同块 <code> 的 textContent（即还原后的源码）。
                    return (
                        `<div class="code-block"${getSourceLineAttr(token)}>` +
                        `<div class="code-block__bar">${langBadge}` +
                        `<button class="code-copy" type="button" title="复制代码" aria-label="复制代码">` +
                        `<svg class="code-copy__check" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5"/></svg>` +
                        `<span class="code-copy__label">复制</span>` +
                        `</button>` +
                        `</div>` +
                        `<pre><code class="hljs${languageClass}">${highlightCode(token.text, language)}</code></pre>` +
                        `</div>`
                    )
                },

                hr(token) {
                    return `<hr${getSourceLineAttr(token)}>`
                },

                list(token) {
                    const tag = token.ordered ? 'ol' : 'ul'
                    const startAttr = token.ordered && token.start !== 1 ? ` start="${token.start}"` : ''
                    const body = token.items
                        .map((item) => {
                            // 传 item.loose 作为 top：tight 列表项不再被包进块级 <p>，
                            // 否则 <p> 会把任务列表的复选框挤到单独一行，并撑出多余的段落间距。
                            let content = this.parser.parse(item.tokens, item.loose)

                            if (item.task) {
                                // 标注到源码行的任务项输出可交互复选框（data-task-line 供预览层勾选回写）；
                                // 定位不到行（如引用块内的任务列表）退回禁用态，只展示不交互。
                                const lineAttr = Number.isFinite(item.sourceLine)
                                    ? `data-task-line="${item.sourceLine}" `
                                    : 'disabled="" '
                                const checkbox = `<input ${item.checked ? 'checked="" ' : ''}${lineAttr}type="checkbox"> `
                                // loose 列表项以块级 <p> 包裹，复选框需并入首段内部才能与文字同行。
                                content =
                                    item.loose && content.startsWith('<p>')
                                        ? content.replace('<p>', `<p>${checkbox}`)
                                        : checkbox + content
                            }

                            return `<li>${content}</li>`
                        })
                        .join('')

                    return `<${tag}${getSourceLineAttr(token)}${startAttr}>${body}</${tag}>`
                },

                link(token) {
                    const href = getSafeUrlAttr(token.href)
                    const text = this.parser.parseInline(token.tokens)
                    if (!href) return text

                    // 绝对 http(s) 链接在新标签打开，避免离开当前正在编辑的文档；锚点/相对链接保持同页。
                    const isExternal = /^https?:\/\//i.test(String(token.href || '').trim())
                    const targetAttr = isExternal ? ' target="_blank" rel="noopener noreferrer"' : ''
                    return `<a href="${href}"${createTitleAttr(token.title)}${targetAttr}>${text}</a>`
                },

                image(token) {
                    const src = getSafeUrlAttr(token.href, {
                        allowDataImage: true,
                        allowedProtocols: ['http', 'https']
                    })
                    const alt = escapeHtml(token.text || '')
                    if (!src) return alt

                    return `<img src="${src}" alt="${alt}"${createTitleAttr(token.title)}>`
                },

                table(token) {
                    const header = token.header
                        .map(
                            (cell, index) =>
                                `<th${getCellAlignAttr(token.align[index])}>${this.parser.parseInline(cell.tokens)}</th>`
                        )
                        .join('')
                    const rows = token.rows
                        .map((row) => {
                            const cells = row
                                .map(
                                    (cell, index) =>
                                        `<td${getCellAlignAttr(token.align[index])}>${this.parser.parseInline(cell.tokens)}</td>`
                                )
                                .join('')

                            return `<tr>${cells}</tr>`
                        })
                        .join('')

                    return `<div class="table-wrap"${getSourceLineAttr(token)}><table><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table></div>`
                }
            }
        }

        // 数学 token 的 renderer 并入 per-call renderers（parser 传 options 会覆盖实例扩展）。
        Object.assign(extensions.renderers, mathRenderers)

        return {
            html: markdownParser.parser(tokens, { extensions }),
            toc
        }
    } catch (error) {
        return {
            html: `<div class="error-hint">解析出错：${escapeHtml(error.message)}</div>`,
            toc
        }
    }
}

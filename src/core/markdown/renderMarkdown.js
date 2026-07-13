import { marked } from 'marked'
import { escapeHtml, stripHtml } from '../text.js'
import { highlightCode } from './highlightCode.js'
import { createSlugger } from './slugger.js'

const getLanguage = (infoString = '') => infoString.trim().split(/\s+/)[0]
const SOURCE_LINE_TYPES = new Set(['blockquote', 'code', 'heading', 'html', 'hr', 'list', 'paragraph', 'table'])

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

        cursorIndex = tokenIndex + token.raw.length
        cursorLine += countLines(token.raw)
    })
}

export const renderMarkdown = (source) => {
    const toc = []

    if (!source.trim()) {
        return {
            html: '<div class="empty-hint">在左侧编辑区输入 Markdown，右侧将实时预览</div>',
            toc
        }
    }

    try {
        const slug = createSlugger()
        const options = {
            breaks: true,
            gfm: true
        }
        const tokens = marked.lexer(source, options)
        annotateSourceLines(tokens, source)

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
                    const languageClass = language ? ` language-${escapeHtml(language)}` : ''

                    return `<pre${getSourceLineAttr(token)}><code class="hljs${languageClass}">${highlightCode(token.text, language)}</code></pre>`
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
                                const checkbox = `<input ${item.checked ? 'checked="" ' : ''}disabled="" type="checkbox"> `
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

                    return `<a href="${href}"${createTitleAttr(token.title)}>${text}</a>`
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

                    return `<table${getSourceLineAttr(token)}><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table>`
                }
            }
        }

        return {
            html: marked.parser(tokens, {
                ...options,
                extensions
            }),
            toc
        }
    } catch (error) {
        return {
            html: `<div class="error-hint">解析出错：${escapeHtml(error.message)}</div>`,
            toc
        }
    }
}

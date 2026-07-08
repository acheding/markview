import { computed } from 'vue'
import { marked } from 'marked'
import hljs from 'highlight.js/lib/core'
import bash from 'highlight.js/lib/languages/bash'
import css from 'highlight.js/lib/languages/css'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import markdown from 'highlight.js/lib/languages/markdown'
import python from 'highlight.js/lib/languages/python'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'
import { createSlugger, escapeHtml, stripHtml } from '../utils/text'

hljs.registerLanguage('bash', bash)
hljs.registerLanguage('css', css)
hljs.registerLanguage('html', xml)
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('json', json)
hljs.registerLanguage('markdown', markdown)
hljs.registerLanguage('python', python)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('xml', xml)

const getLanguage = (infoString = '') => infoString.trim().split(/\s+/)[0]
const SOURCE_LINE_TYPES = new Set([
    'blockquote',
    'code',
    'heading',
    'hr',
    'list',
    'paragraph',
    'table',
])

const countLines = (text) => (text.match(/\n/g) || []).length

const getSourceLineAttr = (token) => (
    Number.isFinite(token?.sourceLine) ? ` data-source-line="${token.sourceLine}"` : ''
)

const getCellAlignAttr = (align) => (align ? ` style="text-align:${align}"` : '')

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

const highlightCode = (code, language) => {
    if (language && hljs.getLanguage(language)) {
        return hljs.highlight(code, { language }).value
    }

    return hljs.highlightAuto(code).value
}

const renderMarkdown = (source) => {
    const toc = []

    if (!source.trim()) {
        return {
            html: '<div class="empty-hint">在左侧编辑区输入 Markdown，右侧将实时预览</div>',
            toc,
        }
    }

    try {
        const slug = createSlugger()
        const options = {
            breaks: true,
            gfm: true,
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
                            const checkbox = item.task
                                ? `<input ${item.checked ? 'checked="" ' : ''}disabled="" type="checkbox"> `
                                : ''
                            const content = this.parser.parse(item.tokens)

                            return `<li>${checkbox}${content}</li>`
                        })
                        .join('')

                    return `<${tag}${getSourceLineAttr(token)}${startAttr}>${body}</${tag}>`
                },

                table(token) {
                    const header = token.header
                        .map((cell, index) => `<th${getCellAlignAttr(token.align[index])}>${this.parser.parseInline(cell.tokens)}</th>`)
                        .join('')
                    const rows = token.rows
                        .map((row) => {
                            const cells = row
                                .map((cell, index) => `<td${getCellAlignAttr(token.align[index])}>${this.parser.parseInline(cell.tokens)}</td>`)
                                .join('')

                            return `<tr>${cells}</tr>`
                        })
                        .join('')

                    return `<table${getSourceLineAttr(token)}><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table>`
                },
            },
        }

        return {
            html: marked.parser(tokens, {
                ...options,
                extensions,
            }),
            toc,
        }
    } catch (error) {
        return {
            html: `<div class="error-hint">解析出错：${escapeHtml(error.message)}</div>`,
            toc,
        }
    }
}

export const useMarkdownRenderer = (source) => {
    const result = computed(() => renderMarkdown(source.value))

    return {
        renderedHtml: computed(() => result.value.html),
        toc: computed(() => result.value.toc),
    }
}

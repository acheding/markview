import { normalizeQuery } from './match.js'

// 摘要按 2 行截断（-webkit-line-clamp: 2）显示，命中词必须落在可视的前 2 行内。
// 前置上下文保持较小，使命中词稳定出现在第 1 行——窄搜索框（如 400px）也不会把高亮挤出可视区。
const SNIPPET_CONTEXT_BEFORE = 12
const SNIPPET_CONTEXT_AFTER = 72
const SNIPPET_FALLBACK_LENGTH = 128

const truncateEnd = (text, maxLength) => {
    if (text.length <= maxLength) return text
    return `${text.slice(0, maxLength)}...`
}

// 围绕命中词裁剪上下文摘要，供搜索结果列表展示。
export const buildSnippet = (line, rawTerm) => {
    const text = String(line || '')
        .trim()
        .replace(/\s+/g, ' ')
    const term = normalizeQuery(rawTerm)
    if (!text) return '空行'
    if (!term) return truncateEnd(text, SNIPPET_FALLBACK_LENGTH)

    const index = text.toLowerCase().indexOf(term)
    if (index < 0) return truncateEnd(text, SNIPPET_FALLBACK_LENGTH)

    // const targetLength = Math.min(text.length, SNIPPET_CONTEXT_BEFORE + term.length + SNIPPET_CONTEXT_AFTER)
    // let start = Math.max(0, index - SNIPPET_CONTEXT_BEFORE)
    // let end = Math.min(text.length, index + term.length + SNIPPET_CONTEXT_AFTER)

    // if (end - start < targetLength) {
    //     if (start === 0) {
    //         end = Math.min(text.length, targetLength)
    //     } else if (end === text.length) {
    //         start = Math.max(0, text.length - targetLength)
    //     }
    // }

    // 命中词固定落在摘要开头附近（前置约 SNIPPET_CONTEXT_BEFORE 字）。
    // 命中词靠近行尾时不把窗口往前拉去补齐长度——否则会把高亮推到摘要末尾、被 2 行 clamp 裁掉。
    // 命中词靠近行首时向后延伸补齐上下文即可。
    const start = Math.max(0, index - SNIPPET_CONTEXT_BEFORE)
    const minEnd = start === 0 ? Math.min(text.length, SNIPPET_CONTEXT_BEFORE + term.length + SNIPPET_CONTEXT_AFTER) : 0
    const end = Math.min(text.length, Math.max(index + term.length + SNIPPET_CONTEXT_AFTER, minEnd))

    const prefix = start > 0 ? '...' : ''
    const suffix = end < text.length ? '...' : ''

    return `${prefix}${text.slice(start, end)}${suffix}`
}

// 把摘要按命中词切成 match / 非 match 片段，供 <mark> 渲染。
export const splitMatchParts = (text, rawTerm) => {
    const term = normalizeQuery(rawTerm)
    if (!term) return [{ text, match: false }]

    const lowerText = text.toLowerCase()
    const parts = []
    let cursor = 0
    let index = lowerText.indexOf(term)

    while (index >= 0) {
        if (index > cursor) {
            parts.push({ text: text.slice(cursor, index), match: false })
        }

        parts.push({ text: text.slice(index, index + term.length), match: true })
        cursor = index + term.length
        index = lowerText.indexOf(term, cursor)
    }

    if (cursor < text.length) {
        parts.push({ text: text.slice(cursor), match: false })
    }

    return parts.length ? parts : [{ text, match: false }]
}

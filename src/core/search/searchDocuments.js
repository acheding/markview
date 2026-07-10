import { normalizeQuery } from './match.js'
import { buildSnippet } from './snippet.js'

const MAX_SEARCH_RESULTS = 80

/**
 * 统一搜索结果模型：
 * {
 *   id: string,                    // 结果唯一键
 *   fileId, fileName: string,
 *   kind: 'name' | 'line',
 *   lineNumber: number | null,     // 1-based，kind='name' 时为 null
 *   match: { from, to } | null,    // 行内列偏移
 *   excerpt: string,               // 摘要
 *   query: string                  // 已归一化的搜索词
 * }
 * 结果列表、编辑器高亮、预览高亮、定位编排全部消费该模型。
 */
export const searchDocuments = (files, rawQuery, { activeFileId = '', limit = MAX_SEARCH_RESULTS } = {}) => {
    const term = normalizeQuery(rawQuery)
    if (!term) return []

    const results = []
    // 当前文档的结果优先，其余保持原有顺序。
    const ordered = files
        .map((file, fileIndex) => ({ file, fileIndex }))
        .sort((left, right) => {
            const activeDiff = Number(right.file.id === activeFileId) - Number(left.file.id === activeFileId)
            return activeDiff || left.fileIndex - right.fileIndex
        })

    for (const { file } of ordered) {
        if (results.length >= limit) break

        if (file.name.toLowerCase().includes(term)) {
            results.push({
                id: `${file.id}:name`,
                fileId: file.id,
                fileName: file.name,
                kind: 'name',
                lineNumber: null,
                match: null,
                excerpt: buildSnippet(file.name, term),
                query: term
            })
        }

        const lines = file.content.split('\n')
        for (let index = 0; index < lines.length && results.length < limit; index += 1) {
            const from = lines[index].toLowerCase().indexOf(term)
            if (from < 0) continue

            results.push({
                id: `${file.id}:line:${index}`,
                fileId: file.id,
                fileName: file.name,
                kind: 'line',
                lineNumber: index + 1,
                match: { from, to: from + term.length },
                excerpt: buildSnippet(lines[index], term),
                query: term
            })
        }
    }

    return results
}

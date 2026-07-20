// 全项目唯一的搜索词归一化与子串匹配实现。
// 搜索框、编辑器高亮、预览高亮都必须经由这里，保证三处命中语义一致。

export const normalizeQuery = (raw) =>
    String(raw || '')
        .trim()
        .toLowerCase()

// 全部命中区间（从左到右、不重叠）。预览高亮需要在块内多处命中中挑选与
// 搜索结果对应的那一处，故不能只取第一个。
export const findAllTextMatches = (text, query) => {
    const term = normalizeQuery(query)
    if (!term) return []

    const haystack = String(text || '').toLowerCase()
    const matches = []
    let from = haystack.indexOf(term)

    while (from >= 0) {
        matches.push({ from, to: from + term.length })
        from = haystack.indexOf(term, from + term.length)
    }

    return matches
}

export const findTextMatch = (text, query) => findAllTextMatches(text, query)[0] ?? null

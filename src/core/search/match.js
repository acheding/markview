// 全项目唯一的搜索词归一化与子串匹配实现。
// 搜索框、编辑器高亮、预览高亮都必须经由这里，保证三处命中语义一致。

export const normalizeQuery = (raw) =>
    String(raw || '')
        .trim()
        .toLowerCase()

export const findTextMatch = (text, query) => {
    const term = normalizeQuery(query)
    if (!term) return null

    const from = String(text || '')
        .toLowerCase()
        .indexOf(term)
    if (from < 0) return null

    return {
        from,
        to: from + term.length
    }
}

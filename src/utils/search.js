export const findTextMatch = (text, query) => {
    const searchQuery = String(query || '').trim()
    if (!searchQuery) return null

    const from = String(text || '')
        .toLowerCase()
        .indexOf(searchQuery.toLowerCase())
    if (from < 0) return null

    return {
        from,
        to: from + searchQuery.length
    }
}

import { ref } from 'vue'

const normalizeQuery = (query) =>
    String(query || '')
        .trim()
        .toLowerCase()

export const useSearchMatch = () => {
    const activeSearchMatch = ref(null)

    const clearSearchMatch = () => {
        activeSearchMatch.value = null
    }

    const setSearchMatch = (result) => {
        if (!result?.fileId || !Number.isFinite(result.lineNumber)) {
            clearSearchMatch()
            return
        }

        activeSearchMatch.value = {
            fileId: result.fileId,
            lineNumber: result.lineNumber,
            matchStart: Number(result.matchStart || 0),
            matchEnd: Number(result.matchEnd || 0),
            query: normalizeQuery(result.query)
        }
    }

    const handleSearchQueryChange = (query) => {
        if (activeSearchMatch.value?.query !== normalizeQuery(query)) {
            clearSearchMatch()
        }
    }

    return {
        activeSearchMatch,
        clearSearchMatch,
        handleSearchQueryChange,
        setSearchMatch
    }
}

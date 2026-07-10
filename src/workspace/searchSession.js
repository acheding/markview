import { computed, ref, watch } from 'vue'
import { normalizeQuery } from '../core/search/match.js'
import { searchDocuments } from '../core/search/searchDocuments.js'

const SEARCH_DEBOUNCE_MS = 120

// 搜索响应式会话：查询词、结果列表、当前激活命中。计算委托 core/search，全项目单一搜索模型。
export const createSearchSession = ({ files, activeFileId }) => {
    const query = ref('')
    const debouncedQuery = ref('')
    // 当前激活命中（编辑器与预览高亮共同消费）：{ fileId, lineNumber, from, to, query } 或 null
    const activeMatch = ref(null)
    let debounceTimer = null

    watch(query, (value) => {
        clearTimeout(debounceTimer)

        if (!value.trim()) {
            debouncedQuery.value = ''
        } else {
            debounceTimer = setTimeout(() => {
                debouncedQuery.value = value
            }, SEARCH_DEBOUNCE_MS)
        }

        // 查询词变化且与当前命中不一致时，清除旧高亮。
        if (activeMatch.value && activeMatch.value.query !== normalizeQuery(value)) {
            activeMatch.value = null
        }
    })

    const results = computed(() =>
        searchDocuments(files.value, debouncedQuery.value, { activeFileId: activeFileId.value })
    )

    const clearActiveMatch = () => {
        activeMatch.value = null
    }

    // 从 SearchResult 记录激活命中（仅行内命中可高亮）。
    const setActiveMatch = (result) => {
        if (result?.fileId && result.kind === 'line' && Number.isFinite(result.lineNumber)) {
            activeMatch.value = {
                fileId: result.fileId,
                lineNumber: result.lineNumber,
                from: result.match?.from ?? 0,
                to: result.match?.to ?? 0,
                query: result.query
            }
        } else {
            clearActiveMatch()
        }
    }

    const clear = () => {
        query.value = ''
        debouncedQuery.value = ''
        clearActiveMatch()
    }

    return {
        query,
        results,
        activeMatch,
        setActiveMatch,
        clearActiveMatch,
        clear
    }
}

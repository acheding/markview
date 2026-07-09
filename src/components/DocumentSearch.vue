<template>
    <div ref="searchRef" class="document-search">
        <label class="document-search__field" for="document-search-input">
            <span class="document-search__icon" aria-hidden="true"></span>
            <input
                id="document-search-input"
                ref="inputRef"
                v-model="query"
                class="document-search__input"
                type="search"
                placeholder="Ctrl + K 搜索文档"
                autocomplete="off"
                aria-label="搜索文档"
                :aria-expanded="isOpen"
                aria-controls="document-search-results"
                @focus="openResults"
                @keydown="handleKeydown"
            >
            <span v-if="query" class="document-search__count">{{ results.length }}</span>
        </label>

        <div
            v-if="isOpen && query"
            id="document-search-results"
            class="document-search__menu"
            role="listbox"
            aria-label="搜索结果"
        >
            <button
                v-for="(result, index) in results"
                :key="result.id"
                class="document-search__result"
                :class="{
                    'is-active': index === activeIndex,
                    'is-current-file': result.fileId === activeFileId,
                }"
                type="button"
                role="option"
                :aria-selected="index === activeIndex"
                @mouseenter="activeIndex = index"
                @click="selectResult(result)"
            >
                <span class="document-search__meta">
                    <span class="document-search__name" :title="result.fileName">{{ result.fileName }}</span>
                    <span class="document-search__badge">
                        {{ result.lineNumber ? `第 ${result.lineNumber} 行` : '文档名' }}
                    </span>
                </span>
                <span class="document-search__excerpt">
                    <template v-for="(part, partIndex) in splitMatch(result.excerpt)" :key="`${result.id}-${partIndex}`">
                        <mark v-if="part.match">{{ part.text }}</mark>
                        <span v-else>{{ part.text }}</span>
                    </template>
                </span>
            </button>

            <div v-if="!results.length" class="document-search__empty">
                没有找到匹配的文档
            </div>
        </div>
    </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps({
    files: {
        type: Array,
        default: () => [],
    },
    activeFileId: {
        type: String,
        default: '',
    },
})

const emit = defineEmits(['select'])

const query = ref('')
const isOpen = ref(false)
const activeIndex = ref(0)
const searchRef = ref(null)
const inputRef = ref(null)

const normalizedQuery = computed(() => query.value.trim().toLowerCase())

const buildSnippet = (line, term) => {
    const text = line.trim().replace(/\s+/g, ' ')
    if (!text) return '空行'
    if (!term) return text

    const index = text.toLowerCase().indexOf(term)
    if (index < 0) return text.slice(0, 84)

    const start = Math.max(0, index - 18)
    const end = Math.min(text.length, index + term.length + 38)
    const prefix = start > 0 ? '...' : ''
    const suffix = end < text.length ? '...' : ''

    return `${prefix}${text.slice(start, end)}${suffix}`
}

const createLineResults = (file, term) => file.content
    .split('\n')
    .map((line, index) => ({
        id: `${file.id}:line:${index}`,
        fileId: file.id,
        fileName: file.name,
        lineNumber: index + 1,
        excerpt: buildSnippet(line, term),
        sortType: 1,
        updatedAt: file.updatedAt,
        sourceIndex: index,
    }))
    .filter((result) => result.excerpt.toLowerCase().includes(term))

const results = computed(() => {
    const term = normalizedQuery.value
    if (!term) return []

    return props.files
        .flatMap((file, fileIndex) => {
            const nameMatch = file.name.toLowerCase().includes(term)
                ? [{
                    id: `${file.id}:name`,
                    fileId: file.id,
                    fileName: file.name,
                    lineNumber: null,
                    excerpt: buildSnippet(file.name, term),
                    sortType: 0,
                    updatedAt: file.updatedAt,
                    sourceIndex: -1,
                    fileIndex,
                }]
                : []

            return [
                ...nameMatch,
                ...createLineResults(file, term).map((result) => ({ ...result, fileIndex })),
            ]
        })
        .sort((left, right) => {
            const activeDiff = Number(right.fileId === props.activeFileId) - Number(left.fileId === props.activeFileId)
            if (activeDiff) return activeDiff

            if (left.sortType !== right.sortType) return left.sortType - right.sortType
            if (left.fileIndex !== right.fileIndex) return left.fileIndex - right.fileIndex
            return left.sourceIndex - right.sourceIndex
        })
})

const splitMatch = (text) => {
    const term = normalizedQuery.value
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

const openResults = () => {
    if (query.value) {
        isOpen.value = true
    }
}

const closeResults = () => {
    isOpen.value = false
}

const selectResult = (result) => {
    emit('select', {
        fileId: result.fileId,
        lineNumber: result.lineNumber,
    })
    closeResults()
}

const handleKeydown = (event) => {
    if (event.key === 'ArrowDown') {
        event.preventDefault()
        isOpen.value = true
        activeIndex.value = Math.min(activeIndex.value + 1, Math.max(results.value.length - 1, 0))
        return
    }

    if (event.key === 'ArrowUp') {
        event.preventDefault()
        activeIndex.value = Math.max(activeIndex.value - 1, 0)
        return
    }

    if (event.key === 'Enter' && results.value[activeIndex.value]) {
        event.preventDefault()
        selectResult(results.value[activeIndex.value])
        return
    }

    if (event.key === 'Escape') {
        event.preventDefault()
        closeResults()
    }
}

const closeOnOutsideClick = (event) => {
    if (!searchRef.value?.contains(event.target)) {
        closeResults()
    }
}

const focusFromShortcut = (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        inputRef.value?.focus()
        inputRef.value?.select()
        openResults()
    }
}

watch(query, () => {
    activeIndex.value = 0
    nextTick(() => {
        isOpen.value = Boolean(query.value)
    })
})

onMounted(() => {
    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', focusFromShortcut)
})

onBeforeUnmount(() => {
    document.removeEventListener('pointerdown', closeOnOutsideClick)
    document.removeEventListener('keydown', focusFromShortcut)
})
</script>

<style scoped>
.document-search {
    position: relative;
    width: min(36vw, 420px);
    min-width: 220px;
}

.document-search__field {
    display: flex;
    align-items: center;
    height: 34px;
    gap: 8px;
    padding: 0 10px;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: var(--color-surface);
    color: var(--color-muted);
    box-shadow: 0 1px 2px rgb(15 23 42 / 4%);
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.document-search__field:focus-within {
    border-color: color-mix(in srgb, var(--color-accent) 48%, #ffffff);
    box-shadow: 0 0 0 3px rgb(15 118 110 / 10%);
}

.document-search__icon {
    position: relative;
    width: 14px;
    height: 14px;
    flex-shrink: 0;
}

.document-search__icon::before {
    position: absolute;
    inset: 1px 3px 3px 1px;
    border: 1.7px solid currentColor;
    border-radius: 50%;
    content: "";
}

.document-search__icon::after {
    position: absolute;
    right: 1px;
    bottom: 1px;
    width: 6px;
    height: 1.7px;
    border-radius: 999px;
    background: currentColor;
    content: "";
    transform: rotate(45deg);
    transform-origin: right center;
}

.document-search__input {
    width: 100%;
    min-width: 0;
    border: none;
    outline: none;
    background: transparent;
    color: var(--color-text);
    font-size: 13px;
}

.document-search__input::placeholder {
    color: var(--color-subtle);
}

.document-search__input::-webkit-search-cancel-button {
    display: none;
}

.document-search__count {
    display: inline-grid;
    min-width: 22px;
    height: 20px;
    place-items: center;
    border-radius: 999px;
    background: var(--color-surface-soft);
    color: var(--color-muted);
    font-size: 11px;
    font-weight: 700;
}

.document-search__menu {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    z-index: 40;
    width: 100%;
    max-height: min(480px, calc(100vh - 90px));
    overflow-y: auto;
    padding: 7px;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: var(--color-surface);
    box-shadow: var(--shadow-menu);
}

.document-search__result {
    display: grid;
    width: 100%;
    gap: 4px;
    padding: 9px 10px;
    border: 1px solid transparent;
    border-radius: 7px;
    background: transparent;
    color: var(--color-text);
    cursor: pointer;
    text-align: left;
    transition: background 0.15s ease, border-color 0.15s ease;
}

.document-search__result:hover,
.document-search__result.is-active {
    border-color: var(--color-border-soft);
    background: var(--color-surface-soft);
}

.document-search__result.is-current-file {
    background: color-mix(in srgb, var(--color-accent-soft) 36%, #ffffff);
}

.document-search__meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    min-width: 0;
}

.document-search__name {
    min-width: 0;
    overflow: hidden;
    color: var(--color-text);
    font-size: 13px;
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.document-search__badge {
    flex-shrink: 0;
    color: var(--color-muted);
    font-size: 11px;
    font-weight: 650;
}

.document-search__excerpt {
    display: -webkit-box;
    overflow: hidden;
    color: var(--color-muted);
    font-size: 12px;
    line-height: 1.45;
    overflow-wrap: anywhere;
    white-space: normal;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
}

.document-search__excerpt mark {
    border-radius: 3px;
    background: #fef3c7;
    color: #92400e;
    font-weight: 700;
    box-decoration-break: clone;
    -webkit-box-decoration-break: clone;
}

.document-search__empty {
    padding: 18px 12px;
    color: var(--color-subtle);
    font-size: 13px;
    text-align: center;
}

@media (max-width: 768px) {
    .document-search {
        width: 100%;
        min-width: 0;
        order: 2;
    }

    .document-search__menu {
        right: auto;
        left: 0;
    }
}
</style>

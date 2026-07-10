<template>
    <div ref="searchRef" class="document-search" :class="{ 'is-expanded': isOpen || query, 'has-query': query }">
        <div class="document-search__field">
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
            />
            <span v-if="query" class="document-search__count">{{ results.length }}</span>
            <button
                v-if="query"
                class="document-search__clear"
                type="button"
                aria-label="清空搜索"
                title="清空搜索"
                @mousedown.prevent
                @click="clearSearch"
            ></button>
        </div>

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
                    'is-current-file': result.fileId === activeFileId
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
                    <template
                        v-for="(part, partIndex) in splitMatch(result.excerpt)"
                        :key="`${result.id}-${partIndex}`"
                    >
                        <mark v-if="part.match">{{ part.text }}</mark>
                        <span v-else>{{ part.text }}</span>
                    </template>
                </span>
            </button>

            <div v-if="!results.length" class="document-search__empty">没有找到匹配的文档</div>
        </div>
    </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const SEARCH_DEBOUNCE_MS = 120
const MAX_SEARCH_RESULTS = 80
const SNIPPET_CONTEXT_BEFORE = 36
const SNIPPET_CONTEXT_AFTER = 72
const SNIPPET_FALLBACK_LENGTH = 128

const props = defineProps({
    files: {
        type: Array,
        default: () => []
    },
    activeFileId: {
        type: String,
        default: ''
    }
})

const emit = defineEmits(['select'])

const query = ref('')
const isOpen = ref(false)
const activeIndex = ref(0)
const searchRef = ref(null)
const inputRef = ref(null)
const debouncedQuery = ref('')
let queryTimer = null

const normalizedQuery = computed(() => debouncedQuery.value.trim().toLowerCase())

const truncateEnd = (text, maxLength) => {
    if (text.length <= maxLength) return text
    return `${text.slice(0, maxLength)}...`
}

const buildSnippet = (line, term) => {
    const text = line.trim().replace(/\s+/g, ' ')
    if (!text) return '空行'
    if (!term) return truncateEnd(text, SNIPPET_FALLBACK_LENGTH)

    const index = text.toLowerCase().indexOf(term)
    if (index < 0) return truncateEnd(text, SNIPPET_FALLBACK_LENGTH)

    const targetLength = Math.min(text.length, SNIPPET_CONTEXT_BEFORE + term.length + SNIPPET_CONTEXT_AFTER)
    let start = Math.max(0, index - SNIPPET_CONTEXT_BEFORE)
    let end = Math.min(text.length, index + term.length + SNIPPET_CONTEXT_AFTER)

    if (end - start < targetLength) {
        if (start === 0) {
            end = Math.min(text.length, targetLength)
        } else if (end === text.length) {
            start = Math.max(0, text.length - targetLength)
        }
    }

    const prefix = start > 0 ? '...' : ''
    const suffix = end < text.length ? '...' : ''

    return `${prefix}${text.slice(start, end)}${suffix}`
}

const appendLineResults = (results, file, term, fileIndex) => {
    const lines = file.content.split('\n')

    for (let index = 0; index < lines.length && results.length < MAX_SEARCH_RESULTS; index += 1) {
        if (!lines[index].toLowerCase().includes(term)) continue

        results.push({
            id: `${file.id}:line:${index}`,
            fileId: file.id,
            fileName: file.name,
            lineNumber: index + 1,
            excerpt: buildSnippet(lines[index], term),
            sortType: 1,
            updatedAt: file.updatedAt,
            sourceIndex: index,
            fileIndex
        })
    }
}

const results = computed(() => {
    const term = normalizedQuery.value
    if (!term) return []

    const matches = []
    const files = props.files
        .map((file, fileIndex) => ({ file, fileIndex }))
        .sort((left, right) => {
            const activeDiff =
                Number(right.file.id === props.activeFileId) - Number(left.file.id === props.activeFileId)
            return activeDiff || left.fileIndex - right.fileIndex
        })

    for (const { file, fileIndex } of files) {
        if (matches.length >= MAX_SEARCH_RESULTS) break

        if (file.name.toLowerCase().includes(term)) {
            matches.push({
                id: `${file.id}:name`,
                fileId: file.id,
                fileName: file.name,
                lineNumber: null,
                excerpt: buildSnippet(file.name, term),
                sortType: 0,
                updatedAt: file.updatedAt,
                sourceIndex: -1,
                fileIndex
            })
        }

        appendLineResults(matches, file, term, fileIndex)
    }

    return matches
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

const clearSearch = () => {
    query.value = ''
    debouncedQuery.value = ''
    activeIndex.value = 0
    closeResults()

    nextTick(() => {
        inputRef.value?.focus()
    })
}

const selectResult = (result) => {
    emit('select', {
        fileId: result.fileId,
        lineNumber: result.lineNumber
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
    clearTimeout(queryTimer)

    if (!query.value.trim()) {
        debouncedQuery.value = ''
    } else {
        queryTimer = setTimeout(() => {
            debouncedQuery.value = query.value
        }, SEARCH_DEBOUNCE_MS)
    }

    nextTick(() => {
        isOpen.value = Boolean(query.value)
    })
})

onMounted(() => {
    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', focusFromShortcut)
})

onBeforeUnmount(() => {
    clearTimeout(queryTimer)
    document.removeEventListener('pointerdown', closeOnOutsideClick)
    document.removeEventListener('keydown', focusFromShortcut)
})
</script>

<style scoped>
.document-search {
    --document-search-collapsed-width: 148px;
    --document-search-expanded-width: min(46vw, 520px);

    position: relative;
    width: var(--document-search-collapsed-width);
    max-width: 100%;
    min-width: 0;
    transition: width 0.3s ease;
}

.document-search:focus-within,
.document-search.is-expanded {
    width: min(100%, var(--document-search-expanded-width));
}

.document-search__field {
    position: relative;
    display: block;
    height: 34px;
    padding: 0;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: var(--color-surface);
    color: var(--color-muted);
    box-shadow: 0 1px 2px rgb(15 23 42 / 4%);
    transition:
        border-color 0.15s ease,
        box-shadow 0.15s ease;
}

.document-search__field:focus-within {
    border-color: color-mix(in srgb, var(--color-accent) 48%, #ffffff);
    box-shadow: 0 0 0 3px rgb(15 118 110 / 10%);
}

.document-search__icon {
    position: absolute;
    top: 50%;
    left: 10px;
    width: 14px;
    height: 14px;
    transform: translateY(-50%);
}

.document-search__icon::before {
    position: absolute;
    inset: 1px 3px 3px 1px;
    border: 1.7px solid currentColor;
    border-radius: 50%;
    content: '';
}

.document-search__icon::after {
    position: absolute;
    right: 1px;
    bottom: 1px;
    width: 6px;
    height: 1.7px;
    border-radius: 999px;
    background: currentColor;
    content: '';
    transform: rotate(45deg);
    transform-origin: right center;
}

.document-search__input {
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    min-width: 0;
    padding: 0 10px 0 32px;
    border: none;
    outline: none;
    background: transparent;
    color: var(--color-text);
    font-size: 13px;
    text-align: left;
    transition: padding 0.3s ease;
}

.document-search.has-query .document-search__input {
    padding-right: 68px;
}

.document-search__input::placeholder {
    color: var(--color-subtle);
}

.document-search__input::-webkit-search-cancel-button {
    display: none;
}

.document-search__count {
    position: absolute;
    top: 50%;
    right: 40px;
    display: inline-grid;
    min-width: 22px;
    height: 20px;
    place-items: center;
    border-radius: 999px;
    background: var(--color-surface-soft);
    color: var(--color-muted);
    font-size: 11px;
    font-weight: 700;
    transform: translateY(-50%);
}

.document-search__clear {
    position: absolute;
    top: 50%;
    right: 8px;
    width: 22px;
    height: 22px;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: var(--color-subtle);
    cursor: pointer;
    transform: translateY(-50%);
    transition:
        background 0.15s ease,
        color 0.15s ease;
}

.document-search__clear:hover,
.document-search__clear:focus-visible {
    background: var(--color-surface-soft);
    color: var(--color-muted);
}

.document-search__clear:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--color-accent) 48%, #ffffff);
    outline-offset: 1px;
}

.document-search__clear::before,
.document-search__clear::after {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 10px;
    height: 1.5px;
    border-radius: 999px;
    background: currentColor;
    content: '';
}

.document-search__clear::before {
    transform: translate(-50%, -50%) rotate(45deg);
}

.document-search__clear::after {
    transform: translate(-50%, -50%) rotate(-45deg);
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
    animation: document-search-menu-in 0.16s ease-out;
}

@keyframes document-search-menu-in {
    from {
        opacity: 0;
        transform: translateY(-4px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
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
    transition:
        background 0.15s ease,
        border-color 0.15s ease;
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

    .document-search:focus-within,
    .document-search.is-expanded {
        width: 100%;
    }

    .document-search__menu {
        right: auto;
        left: 0;
    }
}
</style>

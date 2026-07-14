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
                        v-for="(part, partIndex) in splitMatchParts(result.excerpt, result.query)"
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
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { splitMatchParts } from '../core/search/snippet.js'
import { useWorkspace } from '../workspace/workspaceKey.js'

const { search, documents, actions } = useWorkspace()
const query = search.query
const results = search.results
const activeFileId = documents.activeFileId

const isOpen = ref(false)
const activeIndex = ref(0)
const searchRef = ref(null)
const inputRef = ref(null)

const openResults = () => {
    if (query.value) isOpen.value = true
}

const closeResults = () => {
    isOpen.value = false
}

const clearSearch = () => {
    search.clear()
    activeIndex.value = 0
    closeResults()
    nextTick(() => inputRef.value?.focus())
}

const selectResult = (result) => {
    actions.revealSearchResult(result)
    closeResults()
}

// 键盘移动选中项后，把它滚入结果列表可视区（结果多到出现滚动条时才有意义）。
const scrollActiveIntoView = () => {
    nextTick(() => {
        searchRef.value?.querySelector('.document-search__result.is-active')?.scrollIntoView({ block: 'nearest' })
    })
}

const handleKeydown = (event) => {
    if (event.key === 'ArrowDown') {
        event.preventDefault()
        isOpen.value = true
        activeIndex.value = Math.min(activeIndex.value + 1, Math.max(results.value.length - 1, 0))
        scrollActiveIntoView()
        return
    }

    if (event.key === 'ArrowUp') {
        event.preventDefault()
        activeIndex.value = Math.max(activeIndex.value - 1, 0)
        scrollActiveIntoView()
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
    if (!searchRef.value?.contains(event.target)) closeResults()
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
    --document-search-collapsed-width: 148px;
    --document-search-expanded-width: min(46vw, 400px);

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
    border-radius: var(--radius-lg);
    background: var(--color-surface);
    color: var(--color-muted);
    box-shadow: 0 1px 2px rgb(15 23 42 / 4%);
    transition:
        border-color var(--duration-fast) ease,
        box-shadow var(--duration-fast) ease;
}

.document-search__field:focus-within {
    border-color: color-mix(in srgb, var(--color-accent) 48%, #ffffff);
    box-shadow: 0 0 0 3px rgb(var(--color-accent-channel) / 10%);
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
    font-size: var(--font-size-md);
    text-align: left;
    transition: padding 0.3s ease;
}

.document-search.has-query .document-search__input {
    padding-right: 68px;
}

@media (max-width: 768px) {
    /* 提到 16px，避免 iOS Safari 聚焦时自动放大页面 */
    .document-search__input {
        font-size: 16px;
    }
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
    font-size: var(--font-size-xs);
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
        background var(--duration-fast) ease,
        color var(--duration-fast) ease;
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
    z-index: var(--z-menu);
    width: 100%;
    max-height: min(480px, calc(100vh - 90px));
    overflow-y: auto;
    padding: 7px;
    /* scrollIntoView 时上下各留 7px，与菜单内边距一致，选中项不贴边 */
    scroll-padding-block: 7px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
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
        background var(--duration-fast) ease,
        border-color var(--duration-fast) ease;
}

.document-search__result:hover {
    border-color: var(--color-border-soft);
    background: var(--color-surface-soft);
}

.document-search__result.is-current-file {
    background: color-mix(in srgb, var(--color-accent-soft) 60%, #ffffff);
}

/* 键盘上下键选中项：强调色边框 + 底色 + 左侧强调条，明显区分当前项。
   放在 is-current-file 之后，确保选中态在"当前文档"结果上也不被盖过。 */
.document-search__result.is-active {
    border-color: color-mix(in srgb, var(--color-accent) 55%, transparent);
    background: color-mix(in srgb, var(--color-accent) 14%, var(--color-surface));
    box-shadow: inset 2px 0 0 var(--color-accent);
}

.document-search__result.is-active .document-search__name {
    color: var(--color-accent-strong);
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
    font-size: var(--font-size-md);
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.document-search__badge {
    flex-shrink: 0;
    color: var(--color-muted);
    font-size: var(--font-size-xs);
    font-weight: 650;
}

.document-search__excerpt {
    display: -webkit-box;
    overflow: hidden;
    color: var(--color-muted);
    font-size: var(--font-size-sm);
    line-height: 1.45;
    overflow-wrap: anywhere;
    white-space: normal;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
}

.document-search__excerpt mark {
    border-radius: 3px;
    background: var(--color-search-highlight);
    color: var(--color-search-highlight-text);
    font-weight: 700;
    box-decoration-break: clone;
    -webkit-box-decoration-break: clone;
}

.document-search__empty {
    padding: 18px 12px;
    color: var(--color-subtle);
    font-size: var(--font-size-md);
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

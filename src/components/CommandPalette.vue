<template>
    <Transition name="cmd">
        <div v-if="isOpen" class="cmd-mask" @pointerdown.self="close">
            <div class="cmd-panel" role="dialog" aria-modal="true" aria-label="命令面板">
                <input
                    ref="inputRef"
                    v-model="query"
                    class="cmd-input"
                    type="text"
                    placeholder="输入命令…（新建 / 导出 / 切换主题 / 分享）"
                    aria-label="命令面板"
                    aria-controls="cmd-list"
                    @keydown="onKeydown"
                />

                <div id="cmd-list" ref="listRef" class="cmd-list" role="listbox">
                    <button
                        v-for="(cmd, i) in filtered"
                        :key="cmd.id"
                        class="cmd-item"
                        :class="{ 'is-active': i === activeIndex }"
                        type="button"
                        role="option"
                        :aria-selected="i === activeIndex"
                        @mouseenter="activeIndex = i"
                        @click="run(cmd)"
                    >
                        <span class="cmd-item__title">{{ cmd.title }}</span>
                        <span v-if="cmd.hint" class="cmd-item__hint">{{ cmd.hint }}</span>
                    </button>

                    <div v-if="!filtered.length" class="cmd-empty">没有匹配的命令</div>
                </div>
            </div>
        </div>
    </Transition>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useTheme } from '../composables/useTheme.js'
import { useWorkspace } from '../workspace/workspaceKey.js'

const { documents, actions, exporting, layout, share } = useWorkspace()
const { theme, toggleTheme } = useTheme()

const isOpen = ref(false)
const query = ref('')
const activeIndex = ref(0)
const inputRef = ref(null)
const listRef = ref(null)

const commands = computed(() => {
    const base = [
        { id: 'new', title: '新建文档', hint: '', run: () => documents.create() },
        { id: 'clear', title: '清空当前内容', run: () => actions.clearContent() },
        { id: 'export-md', title: '导出 Markdown', run: () => exporting.exportActiveFile() },
        { id: 'export-pdf', title: '导出 PDF', run: () => exporting.exportPdf() },
        { id: 'share', title: '复制分享链接', run: () => share() },
        {
            id: 'theme',
            title: theme.value === 'dark' ? '切换到浅色主题' : '切换到暗色主题',
            run: () => toggleTheme()
        },
        {
            id: 'toggle-editor',
            title: layout.isEditorCollapsed.value ? '展开编辑区' : '折叠编辑区',
            run: () => actions.setEditorCollapsed(!layout.isEditorCollapsed.value)
        }
    ]

    // 切换到其它文档
    const docs = documents.files.value
        .filter((file) => file.id !== documents.activeFileId.value)
        .map((file) => ({
            id: `doc-${file.id}`,
            title: `切换到 ${file.name}`,
            hint: '文档',
            run: () => documents.select(file.id)
        }))

    return [...base, ...docs]
})

// 子序列模糊匹配：输入的每个字符按序出现在标题中即命中（大小写不敏感）。
const fuzzyMatch = (text, q) => {
    let index = 0
    for (const ch of q) {
        index = text.indexOf(ch, index)
        if (index < 0) return false
        index += 1
    }
    return true
}

const filtered = computed(() => {
    const q = query.value.trim().toLowerCase()
    if (!q) return commands.value
    return commands.value.filter((cmd) => fuzzyMatch(cmd.title.toLowerCase(), q))
})

watch(filtered, () => {
    activeIndex.value = 0
})

const scrollActiveIntoView = () => {
    nextTick(() => {
        listRef.value?.querySelector('.cmd-item.is-active')?.scrollIntoView({ block: 'nearest' })
    })
}

const open = () => {
    isOpen.value = true
    query.value = ''
    activeIndex.value = 0
    nextTick(() => inputRef.value?.focus())
}

const close = () => {
    isOpen.value = false
}

const run = (cmd) => {
    close()
    // 关闭面板后再执行，避免命令弹出的确认框/焦点被面板抢占。
    nextTick(() => cmd.run())
}

const onKeydown = (event) => {
    if (event.key === 'ArrowDown') {
        event.preventDefault()
        activeIndex.value = Math.min(activeIndex.value + 1, filtered.value.length - 1)
        scrollActiveIntoView()
    } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        activeIndex.value = Math.max(activeIndex.value - 1, 0)
        scrollActiveIntoView()
    } else if (event.key === 'Enter') {
        event.preventDefault()
        const cmd = filtered.value[activeIndex.value]
        if (cmd) run(cmd)
    } else if (event.key === 'Escape') {
        event.preventDefault()
        close()
    }
}

const onGlobalKeydown = (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'p') {
        event.preventDefault()
        if (isOpen.value) close()
        else open()
    }
}

onMounted(() => document.addEventListener('keydown', onGlobalKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', onGlobalKeydown))
</script>

<style scoped>
.cmd-mask {
    position: fixed;
    inset: 0;
    z-index: calc(var(--z-toolbar) + 30);
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding: 12vh 20px 20px;
    background: rgb(15 23 42 / 32%);
    backdrop-filter: blur(2px);
}

.cmd-panel {
    display: flex;
    flex-direction: column;
    width: min(560px, 92vw);
    max-height: 70vh;
    overflow: hidden;
    border: 1px solid var(--color-border-soft);
    border-radius: var(--radius-lg);
    background: var(--color-surface);
    box-shadow: var(--shadow-menu);
}

.cmd-input {
    flex-shrink: 0;
    height: 50px;
    padding: 0 18px;
    border: none;
    border-bottom: 1px solid var(--color-border-soft);
    outline: none;
    background: transparent;
    color: var(--color-text);
    font-size: var(--font-size-lg);
}

.cmd-input::placeholder {
    color: var(--color-subtle);
}

.cmd-list {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 6px;
    scroll-padding-block: 6px;
}

.cmd-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    width: 100%;
    padding: 10px 12px;
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--color-text);
    cursor: pointer;
    text-align: left;
    transition:
        background var(--duration-fast) ease,
        border-color var(--duration-fast) ease;
}

.cmd-item.is-active {
    border-color: color-mix(in srgb, var(--color-accent) 40%, transparent);
    background: color-mix(in srgb, var(--color-accent) 12%, var(--color-surface));
    box-shadow: inset 2px 0 0 var(--color-accent);
}

.cmd-item__title {
    min-width: 0;
    overflow: hidden;
    font-size: var(--font-size-base);
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.cmd-item.is-active .cmd-item__title {
    color: var(--color-accent-strong);
}

.cmd-item__hint {
    flex-shrink: 0;
    padding: 2px 7px;
    border-radius: var(--radius-full);
    background: var(--color-surface-soft);
    color: var(--color-muted);
    font-size: var(--font-size-xs);
    font-weight: 650;
}

.cmd-empty {
    padding: 20px 12px;
    color: var(--color-subtle);
    font-size: var(--font-size-md);
    text-align: center;
}

.cmd-enter-active,
.cmd-leave-active {
    transition: opacity var(--duration-fast) ease;
}

.cmd-enter-active .cmd-panel,
.cmd-leave-active .cmd-panel {
    transition:
        opacity var(--duration-fast) ease,
        transform var(--duration-fast) ease;
}

.cmd-enter-from,
.cmd-leave-to {
    opacity: 0;
}

.cmd-enter-from .cmd-panel,
.cmd-leave-to .cmd-panel {
    opacity: 0;
    transform: translateY(-8px) scale(0.99);
}
</style>

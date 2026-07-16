<template>
    <Transition name="cmd">
        <div v-if="isOpen" class="cmd-mask" @pointerdown.self="close">
            <div class="cmd-panel" role="dialog" aria-modal="true" aria-label="命令面板">
                <input
                    ref="inputRef"
                    v-model="query"
                    class="cmd-input"
                    type="text"
                    placeholder="输入命令或文档名…（新建 / 导入 / 导出 / 分享 / 切换文档）"
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
                        @mousemove="activeIndex = i"
                        @click="run(cmd)"
                    >
                        <span class="cmd-item__title">{{ cmd.title }}</span>
                        <span v-if="cmd.hint" class="cmd-item__hint">{{ cmd.hint }}</span>
                        <span v-if="cmd.keys" class="cmd-item__keys">{{ cmd.keys }}</span>
                    </button>

                    <div v-if="!filtered.length" class="cmd-empty">没有匹配的命令</div>
                </div>
            </div>
        </div>
    </Transition>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { matchesShortcut, shortcutLabel } from '../composables/shortcuts.js'
import { useCommandUsage } from '../composables/useCommandUsage.js'
import { useWorkspace } from '../workspace/workspaceKey.js'

const { documents, commands: registry } = useWorkspace()
const { recordUse, usageOf } = useCommandUsage()

const isOpen = ref(false)
const query = ref('')
const activeIndex = ref(0)
const inputRef = ref(null)
const listRef = ref(null)

const commands = computed(() => {
    // 注册表命令（与全局快捷键同源，见 workspace/commands.js）：
    // 标题在此求值，折叠态 / 主题等动态标题的依赖由 computed 顺势收集。
    const base = registry
        .filter((cmd) => cmd.inPalette !== false)
        .map((cmd) => ({
            id: cmd.id,
            title: cmd.title(),
            hint: cmd.hint,
            keys: shortcutLabel(cmd.id),
            run: cmd.run
        }))

    // 切换到其它文档
    const docs = documents.files.value
        .filter((file) => file.id !== documents.activeFileId.value)
        .map((file) => ({
            id: `doc-${file.id}`,
            title: `切换到 ${file.name}`,
            hint: '文档',
            run: () => documents.select(file.id)
        }))

    // 按使用次数降序贴合用户习惯；次数相同时 sort 稳定，保持预设顺序。
    return [...base, ...docs].sort((a, b) => usageOf(b.id) - usageOf(a.id))
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
    recordUse(cmd.id)
    // 关闭面板后再执行，避免命令弹出的确认框/焦点被面板抢占。
    nextTick(() => cmd.run())
}

const onKeydown = (event) => {
    const count = filtered.value.length
    if (event.key === 'ArrowDown') {
        event.preventDefault()
        if (count) activeIndex.value = (activeIndex.value + 1) % count
        scrollActiveIntoView()
    } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        if (count) activeIndex.value = (activeIndex.value - 1 + count) % count
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
    if (matchesShortcut(event, 'palette')) {
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
    /* 450px ≈ 输入框 50px + 列表 10 行（38px/条），对齐命令面板 8~12 行的通行密度；小屏退到 70vh */
    max-height: min(450px, 70vh);
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

@media (max-width: 768px) {
    /* 提到 16px，避免 iOS Safari 聚焦时自动放大页面 */
    .cmd-input {
        font-size: 16px;
    }
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
    flex: 1;
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

.cmd-item__keys {
    flex-shrink: 0;
    color: var(--color-subtle);
    font-family: var(--font-mono);
    font-size: var(--font-size-xs);
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

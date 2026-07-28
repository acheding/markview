<template>
    <aside ref="tocRef" class="toc" :style="{ width }" aria-label="文档目录">
        <div v-if="items.length" class="toc__list">
            <button
                v-for="item in view.visibleItems"
                :key="item.id"
                type="button"
                class="toc__item"
                :class="{
                    'is-active': item.id === view.displayActiveId,
                    'is-pending': item.id === navigatingId && item.id !== view.displayActiveId
                }"
                :style="{ paddingLeft: `${(item.level - 1) * 12 + 4}px` }"
                :title="item.title"
                @click="select(item.id)"
            >
                <!-- 有子标题的条目带折叠箭头；无子项放同宽占位保持同级文字对齐 -->
                <span
                    v-if="item.hasChildren"
                    class="toc__caret"
                    :class="{ 'is-collapsed': item.collapsed }"
                    role="button"
                    tabindex="-1"
                    :aria-label="item.collapsed ? '展开小节' : '折叠小节'"
                    :aria-expanded="!item.collapsed"
                    @click.stop="toggleCollapse(item.id)"
                />
                <span v-else class="toc__caret toc__caret--leaf" aria-hidden="true" />
                <span class="toc__label">{{ item.title }}</span>
            </button>
        </div>

        <div v-else class="toc__empty" role="status">
            <span class="toc__empty-icon" :style="{ '--icon-url': `url(${tocEmptyIcon})` }" aria-hidden="true" />
            <span class="toc__empty-label">暂无目录</span>
        </div>
    </aside>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import tocEmptyIcon from '../assets/toc-empty.svg'
import { computeTocView } from '../core/toc/tocTree.js'

const props = defineProps({
    items: {
        type: Array,
        default: () => []
    },
    activeId: {
        type: String,
        default: ''
    },
    width: {
        type: String,
        default: '220px'
    }
})

const emit = defineEmits(['select'])

const tocRef = ref(null)
// 本组件发起的导航目标：点击后、activeId 抵达前，用它给目标「悬浮态」并抑制面板滚动。
const navigatingId = ref('')
// 被折叠的标题 id 集合；折叠某项即隐藏其整棵子树。
const collapsedIds = ref(new Set())

const view = computed(() => computeTocView(props.items, collapsedIds.value, props.activeId))

const toggleCollapse = (id) => {
    const next = new Set(collapsedIds.value)
    if (!next.delete(id)) next.add(id)
    collapsedIds.value = next
}

// 文档编辑/切换后清理已不存在的 id，防止集合随长期编辑无限增长。
watch(
    () => props.items,
    (items) => {
        if (!collapsedIds.value.size) return
        const alive = new Set(items.map((item) => item.id))
        const next = new Set([...collapsedIds.value].filter((id) => alive.has(id)))
        if (next.size !== collapsedIds.value.size) collapsedIds.value = next
    }
)

const select = (id) => {
    navigatingId.value = id
    emit('select', id)
}

const scrollActiveItemIntoView = async () => {
    if (!props.activeId) return

    await nextTick()

    const toc = tocRef.value
    const activeItem = toc?.querySelector('.toc__item.is-active')
    if (!toc || !activeItem) return

    const tocRect = toc.getBoundingClientRect()
    const itemRect = activeItem.getBoundingClientRect()
    const tocStyles = getComputedStyle(toc)
    const visibleTop = tocRect.top + (Number.parseFloat(tocStyles.paddingTop) || 0)
    const visibleBottom = tocRect.bottom - (Number.parseFloat(tocStyles.paddingBottom) || 0)

    if (itemRect.top < visibleTop) {
        toc.scrollTop -= visibleTop - itemRect.top
    } else if (itemRect.bottom > visibleBottom) {
        toc.scrollTop += itemRect.bottom - visibleBottom
    }
}

// active 变化：抵达导航目标即结束导航；仅在非导航态跟随滚动。
// 于是点击导航时面板保持不动、选中态在原位逐项挪向目标；抵达后若目标在视野外再兜底滚一次。
watch(
    () => props.activeId,
    (id) => {
        if (id === navigatingId.value) navigatingId.value = ''
        if (!navigatingId.value) scrollActiveItemIntoView()
    }
)
</script>

<style scoped>
.toc {
    min-width: 180px;
    max-width: 360px;
    padding: 14px 10px;
    overflow-y: auto;
    background: var(--color-surface-soft);
    color: var(--color-muted);
}

.toc__list {
    display: grid;
    gap: 2px;
}

.toc__item {
    display: flex;
    align-items: center;
    gap: 2px;
    width: 100%;
    min-height: 30px;
    padding-top: 6px;
    padding-right: 8px;
    padding-bottom: 6px;
    overflow: hidden;
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    background: transparent;
    color: inherit;
    cursor: pointer;
    font: inherit;
    font-size: var(--font-size-sm);
    line-height: 1.35;
    text-align: left;
    transition:
        color var(--duration-fast) ease,
        background var(--duration-fast) ease,
        border-color var(--duration-fast) ease;
}

.toc__label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

/* 折叠箭头：展开为向下 chevron，折叠时转成向右 */
.toc__caret {
    display: inline-grid;
    flex-shrink: 0;
    place-items: center;
    width: 16px;
    height: 16px;
    border-radius: var(--radius-sm);
    transition: background var(--duration-fast) ease;
}

.toc__caret::before {
    content: '';
    width: 5px;
    height: 5px;
    border-right: 1.5px solid currentColor;
    border-bottom: 1.5px solid currentColor;
    opacity: 0.55;
    transform: translateY(-1px) rotate(45deg);
    transition:
        transform var(--duration-fast) ease,
        opacity var(--duration-fast) ease;
}

.toc__caret.is-collapsed::before {
    transform: translateX(-1px) rotate(-45deg);
}

.toc__caret:hover {
    background: color-mix(in srgb, var(--color-accent) 14%, transparent);
}

.toc__caret:hover::before {
    opacity: 1;
}

/* 叶子占位仅用于同级对齐：无三角、不响应 hover */
.toc__caret--leaf {
    pointer-events: none;
}

.toc__caret--leaf::before {
    content: none;
}

.toc__item:hover,
.toc__item.is-pending {
    color: var(--color-accent);
    background: var(--color-surface);
    border-color: var(--color-border-soft);
}

.toc__item.is-active {
    color: var(--color-accent-strong);
    background: var(--color-surface-active);
    border-color: color-mix(in srgb, var(--color-accent) 22%, #ffffff);
    font-weight: 650;
}

.toc__empty {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    gap: 10px;
    min-height: min(260px, 42vh);
    padding: 28px 12px;
    color: var(--color-subtle);
    text-align: center;
}

.toc__empty-icon {
    width: 42px;
    height: 42px;
    color: color-mix(in srgb, var(--color-muted) 62%, transparent);
    background: currentColor;
    mask: var(--icon-url) center / contain no-repeat;
    -webkit-mask: var(--icon-url) center / contain no-repeat;
}

.toc__empty-label {
    font-size: var(--font-size-sm);
    line-height: 1.5;
}

@media (max-width: 1120px) {
    .toc {
        min-width: 160px;
    }
}

@media (max-width: 900px) {
    .toc {
        display: none;
    }
}
</style>

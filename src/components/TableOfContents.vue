<template>
    <aside class="toc" :style="{ width }" aria-label="文档目录">
        <div class="toc__title">目录</div>

        <div v-if="items.length" class="toc__list">
            <button
                v-for="item in items"
                :key="item.id"
                type="button"
                class="toc__item"
                :class="{ 'is-active': item.id === activeId }"
                :style="{ paddingLeft: `${(item.level - 1) * 12 + 10}px` }"
                :title="item.title"
                @click="$emit('select', item.id)"
            >
                {{ item.title }}
            </button>
        </div>

        <div v-else class="toc__empty">暂无目录</div>
    </aside>
</template>

<script setup>
import { nextTick, watch } from 'vue'

const props = defineProps({
    items: {
        type: Array,
        default: () => [],
    },
    activeId: {
        type: String,
        default: '',
    },
    width: {
        type: String,
        default: '220px',
    },
})

defineEmits(['select'])

const scrollActiveItemIntoView = async () => {
    if (!props.activeId) return

    await nextTick()

    const toc = document.querySelector('.toc')
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

watch(() => props.activeId, scrollActiveItemIntoView)
</script>

<style scoped>
.toc {
    min-width: 180px;
    max-width: 360px;
    padding: 14px 10px;
    overflow-y: auto;
    background: #fbfdff;
    color: var(--color-muted);
}

.toc__title {
    padding: 0 10px 10px;
    color: var(--color-subtle);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0;
}

.toc__list {
    display: grid;
    gap: 2px;
}

.toc__item {
    display: block;
    width: 100%;
    min-height: 30px;
    padding-top: 6px;
    padding-right: 8px;
    padding-bottom: 6px;
    overflow: hidden;
    border: 1px solid transparent;
    border-radius: 6px;
    background: transparent;
    color: inherit;
    cursor: pointer;
    font: inherit;
    font-size: 12px;
    line-height: 1.35;
    text-align: left;
    text-overflow: ellipsis;
    white-space: nowrap;
    transition: color 0.15s ease, background 0.15s ease, border-color 0.15s ease;
}

.toc__item:hover {
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
    padding: 12px 10px;
    color: var(--color-subtle);
    font-size: 12px;
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

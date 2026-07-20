<template>
    <div
        class="divider"
        role="separator"
        :aria-orientation="orientation"
        :class="{ 'is-active': active, 'is-collapsed': collapsed }"
        @pointerdown="$emit('resize-start', $event)"
    ></div>
</template>

<script setup>
defineProps({
    active: {
        type: Boolean,
        default: false
    },
    collapsed: {
        type: Boolean,
        default: false
    },
    // 纵向堆叠布局下分隔线转为水平方向，语义随之变化。
    orientation: {
        type: String,
        default: 'vertical'
    }
})

defineEmits(['resize-start'])
</script>

<style scoped>
.divider {
    position: relative;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1px;
    flex-shrink: 0;
    cursor: col-resize;
    transition: opacity 0.22s ease;
}

.divider.is-collapsed {
    width: 0;
    opacity: 0;
    pointer-events: none;
}

.divider::before {
    width: 1px;
    height: 100%;
    background: var(--color-border);
    content: '';
    transition:
        background var(--duration-fast) ease,
        box-shadow var(--duration-fast) ease;
}

/* 命中区向分割线两侧扩展，不参与 flex 布局。 */
.divider::after {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 50%;
    width: 5px;
    cursor: col-resize;
    content: '';
    transform: translateX(-50%);
    transition: background var(--duration-fast) ease;
}

/* hover / 拖拽时整条命中区填充浅色，中间的边框线本身隐去 */
.divider:hover::before,
.divider.is-active::before {
    background: transparent;
}

.divider:hover::after,
.divider.is-active::after {
    background: rgb(var(--color-accent-channel) / 22%);
}

@media (max-width: 768px) {
    .divider {
        width: 100%;
        height: 1px;
        cursor: default;
        /* 纵向堆叠为固定分屏，分隔线退化为静态分隔条：不再接管指针事件 */
        pointer-events: none;
    }

    .divider.is-collapsed {
        width: 100%;
        height: 0;
    }

    .divider::before {
        width: 100%;
        height: 1px;
    }

    .divider::after {
        top: 50%;
        right: 0;
        bottom: auto;
        left: 0;
        width: 100%;
        height: 5px;
        cursor: default;
        transform: translateY(-50%);
    }
}
</style>

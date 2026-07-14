<template>
    <div
        class="divider"
        role="separator"
        aria-orientation="vertical"
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
    background: transparent;
    transition:
        background var(--duration-fast) ease,
        opacity 0.22s ease;
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
}

.divider:hover,
.divider.is-active {
    background: rgb(var(--color-accent-channel) / 5%);
}

.divider:hover::before,
.divider.is-active::before {
    box-shadow: 0 0 0 2px rgb(var(--color-accent-channel) / 10%);
}

@media (max-width: 768px) {
    .divider {
        width: 100%;
        height: 1px;
        cursor: default;
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

<template>
    <div
        class="divider"
        role="separator"
        aria-orientation="vertical"
        :class="{ 'is-active': active }"
        @pointerdown="$emit('resize-start', $event)"
    >
    </div>
</template>

<script setup>
defineProps({
    active: {
        type: Boolean,
        default: false,
    },
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
    width: 5px;
    flex-shrink: 0;
    cursor: col-resize;
    background: transparent;
    transition: background 0.15s ease;
}

.divider::before {
    width: 1px;
    height: 100%;
    background: var(--color-border);
    content: "";
    transition: background 0.15s ease, box-shadow 0.15s ease;
}

.divider:hover,
.divider.is-active {
    background: rgb(15 118 110 / 5%);
}

.divider:hover::before,
.divider.is-active::before {
    background: var(--color-accent);
    box-shadow: 0 0 0 2px rgb(15 118 110 / 10%);
}

@media (max-width: 768px) {
    .divider {
        width: 100%;
        height: 5px;
        cursor: default;
    }

    .divider::before {
        width: 100%;
        height: 1px;
    }
}
</style>

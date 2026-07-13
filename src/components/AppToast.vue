<template>
    <Transition name="toast">
        <div
            v-if="toast.visible.value"
            class="app-toast"
            :class="`app-toast--${toast.tone.value}`"
            role="status"
            aria-live="polite"
        >
            <span class="app-toast__icon" aria-hidden="true">{{ icon }}</span>
            <span class="app-toast__text">{{ toast.message.value }}</span>
        </div>
    </Transition>
</template>

<script setup>
import { computed } from 'vue'
import { useWorkspace } from '../workspace/workspaceKey.js'

const { toast } = useWorkspace()

const ICONS = {
    success: '✓',
    warn: '!',
    info: 'i'
}

const icon = computed(() => ICONS[toast.tone.value] || ICONS.info)
</script>

<style scoped>
.app-toast {
    position: fixed;
    /* 垂直居中于 58px 高的顶部 header 行内 */
    top: 29px;
    left: 50%;
    z-index: calc(var(--z-toolbar) + 10);
    display: inline-flex;
    align-items: center;
    gap: 8px;
    max-width: min(80vw, 420px);
    padding: 7px 16px 7px 10px;
    border: 1px solid var(--color-border-soft);
    border-radius: var(--radius-full);
    background: var(--color-surface-glass);
    color: var(--color-text);
    font-size: var(--font-size-base);
    font-weight: 550;
    box-shadow: var(--shadow-menu);
    backdrop-filter: blur(10px);
    transform: translate(-50%, -50%);
}

.app-toast__icon {
    display: inline-grid;
    place-items: center;
    width: 18px;
    height: 18px;
    flex-shrink: 0;
    border-radius: var(--radius-full);
    color: #ffffff;
    font-size: var(--font-size-xs);
    font-weight: 700;
    line-height: 1;
}

.app-toast--success .app-toast__icon {
    background: var(--color-accent-solid);
}

.app-toast--warn .app-toast__icon {
    background: var(--color-danger);
}

.app-toast--info .app-toast__icon {
    background: var(--color-subtle);
    font-style: italic;
}

.app-toast__text {
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.toast-enter-active,
.toast-leave-active {
    transition:
        opacity var(--duration-fast) ease,
        transform var(--duration-fast) ease;
}

.toast-enter-from,
.toast-leave-to {
    opacity: 0;
    /* 由上方轻微滑入（-50% 保持水平居中，另叠加向上位移） */
    transform: translate(-50%, calc(-50% - 8px));
}
</style>

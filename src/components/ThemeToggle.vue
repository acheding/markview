<template>
    <button
        class="theme-toggle"
        type="button"
        v-tooltip="{ text: theme === 'dark' ? '切换到浅色' : '切换到暗色', keys: shortcutLabel('theme') }"
        :aria-label="theme === 'dark' ? '切换到浅色模式' : '切换到暗色模式'"
        @click="toggleTheme"
    >
        <!-- 暗色态显示太阳（点击回到浅色），浅色态显示月亮；切换时两图标同向旋转交叉交接 -->
        <Transition name="theme-icon">
            <svg
                v-if="theme === 'dark'"
                key="sun"
                class="theme-toggle__icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
            >
                <circle cx="12" cy="12" r="4" />
                <path
                    d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"
                />
            </svg>
            <svg
                v-else
                key="moon"
                class="theme-toggle__icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
            >
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
        </Transition>
    </button>
</template>

<script setup>
import { shortcutLabel } from '../composables/shortcuts.js'
import { useTheme } from '../composables/useTheme.js'

const { theme, toggleTheme } = useTheme()
</script>

<style scoped>
.theme-toggle {
    display: inline-grid;
    place-items: center;
    width: 34px;
    height: 34px;
    padding: 0;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    color: var(--color-muted);
    cursor: pointer;
    box-shadow: 0 1px 2px rgb(15 23 42 / 4%);
    transition:
        transform var(--duration-fast) ease,
        background var(--duration-fast) ease,
        border-color var(--duration-fast) ease,
        color var(--duration-fast) ease,
        box-shadow var(--duration-fast) ease;
}

.theme-toggle:hover {
    border-color: color-mix(in srgb, var(--color-accent) 38%, transparent);
    background: var(--color-surface-active);
    color: var(--color-accent);
    box-shadow: 0 6px 14px rgb(var(--color-accent-channel) / 12%);
    transform: translateY(-1px);
}

.theme-toggle:active {
    transform: translateY(0);
}

/* 两个图标叠在按钮网格同一格，交叉过渡时互不挤占位置 */
.theme-toggle__icon {
    grid-area: 1 / 1;
    width: 18px;
    height: 18px;
}

.theme-icon-enter-active,
.theme-icon-leave-active {
    transition:
        transform 0.32s ease,
        opacity 0.32s ease;
}

/* 同向旋转：旧图标顺时针转出，新图标从逆时针方向转入 */
.theme-icon-enter-from {
    opacity: 0;
    transform: rotate(-90deg) scale(0.5);
}

.theme-icon-leave-to {
    opacity: 0;
    transform: rotate(90deg) scale(0.5);
}

@media (prefers-reduced-motion: reduce) {
    .theme-icon-enter-active,
    .theme-icon-leave-active {
        transition: none;
    }
}
</style>

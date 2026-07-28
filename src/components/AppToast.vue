<template>
    <Transition name="toast">
        <div
            v-if="toast.visible.value"
            class="app-toast"
            :class="`app-toast--${toast.tone.value}`"
            role="status"
            aria-live="polite"
        >
            <span class="app-toast__icon" aria-hidden="true">
                <span class="app-toast__glyph" :style="{ '--icon-url': `url(${iconUrl})` }" />
            </span>
            <span class="app-toast__text">{{ toast.message.value }}</span>
        </div>
    </Transition>
</template>

<script setup>
import { computed } from 'vue'
import { useWorkspace } from '../workspace/workspaceKey.js'
import successIcon from '../assets/toast-success.svg'
import warningIcon from '../assets/toast-warning.svg'
import infoIcon from '../assets/toast-info.svg'

const { toast } = useWorkspace()

// error 复用 warning 的感叹号，仅圆底配色不同
const ICON_URLS = {
    success: successIcon,
    warning: warningIcon,
    error: warningIcon,
    info: infoIcon
}

const iconUrl = computed(() => ICON_URLS[toast.tone.value] || infoIcon)
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
    max-width: min(calc(100vw - 24px), 520px);
    box-sizing: border-box;
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
}

/* 与 .toolbar-action-icon 一致的单色遮罩管线：形状来自 SVG，颜色取自 currentColor */
.app-toast__glyph {
    width: 12px;
    height: 12px;
    background: currentColor;
    mask: var(--icon-url) center / contain no-repeat;
    -webkit-mask: var(--icon-url) center / contain no-repeat;
}

.app-toast--success .app-toast__icon {
    background: var(--color-accent-solid);
}

/* error：错误（红）；warning：警告 / 部分成功等需提醒但非错误的情况（橙黄） */
.app-toast--error .app-toast__icon {
    background: var(--color-danger);
}

.app-toast--warning .app-toast__icon {
    background: var(--color-warning);
}

.app-toast--info .app-toast__icon {
    background: var(--color-subtle);
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

/* 圆底图标比整体滑入晚 80ms 再回弹放大登场，backwards 让延迟期间保持 scale(0) */
.toast-enter-active .app-toast__icon {
    animation: toast-icon-pop 0.28s cubic-bezier(0.34, 1.56, 0.64, 1) 80ms backwards;
}

@keyframes toast-icon-pop {
    from {
        transform: scale(0);
    }

    to {
        transform: scale(1);
    }
}
</style>

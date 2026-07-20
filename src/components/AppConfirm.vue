<template>
    <Transition name="confirm">
        <!-- Esc / 点遮罩是「未做选择」（dismiss），与显式点击取消按钮区分：
             取消按钮可能承载具体动作（如丢失文件弹窗里的「取消关联」），不可被逃逸键误触 -->
        <div v-if="confirmDialog.visible.value" class="confirm-mask" @pointerdown.self="confirmDialog.dismiss()">
            <div
                class="confirm-dialog"
                :class="`confirm-dialog--${options.tone}`"
                role="alertdialog"
                aria-modal="true"
                :aria-label="options.title || options.message"
                tabindex="-1"
                @keydown="handleKeydown"
            >
                <p v-if="options.title" class="confirm-dialog__title">{{ options.title }}</p>
                <p class="confirm-dialog__message">{{ options.message }}</p>

                <div class="confirm-dialog__actions">
                    <button type="button" class="confirm-btn confirm-btn--cancel" @click="confirmDialog.cancel()">
                        {{ options.cancelLabel }}
                    </button>
                    <button
                        ref="confirmBtnRef"
                        type="button"
                        class="confirm-btn confirm-btn--confirm"
                        @click="confirmDialog.confirm()"
                    >
                        {{ options.confirmLabel }}
                    </button>
                </div>
            </div>
        </div>
    </Transition>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { useWorkspace } from '../workspace/workspaceKey.js'

const { confirm: confirmDialog } = useWorkspace()

const confirmBtnRef = ref(null)
const options = computed(() => confirmDialog.options.value)

const handleKeydown = (event) => {
    if (event.key === 'Escape') {
        event.preventDefault()
        confirmDialog.dismiss()
    } else if (event.key === 'Enter') {
        event.preventDefault()
        confirmDialog.confirm()
    }
}

// 打开时聚焦确认按钮，回车即确认、Esc 即取消。
watch(
    () => confirmDialog.visible.value,
    async (open) => {
        if (!open) return
        await nextTick()
        confirmBtnRef.value?.focus()
    }
)
</script>

<style scoped>
.confirm-mask {
    position: fixed;
    inset: 0;
    z-index: calc(var(--z-toolbar) + 20);
    display: grid;
    place-items: center;
    padding: 20px;
    background: rgb(15 23 42 / 32%);
    backdrop-filter: blur(2px);
}

.confirm-dialog {
    width: 100%;
    max-width: 400px;
    padding: 20px 22px 18px;
    border: 1px solid var(--color-border-soft);
    border-radius: var(--radius-lg);
    background: var(--color-surface);
    box-shadow: var(--shadow-menu);
}

.confirm-dialog__title {
    margin: 0 0 6px;
    color: var(--color-text);
    font-size: var(--font-size-lg);
    font-weight: 700;
}

.confirm-dialog__message {
    margin: 0;
    color: var(--color-muted);
    font-size: var(--font-size-base);
    line-height: 1.6;
    word-break: break-word;
}

/* 按钮文案可能较长（如「仅保留在 MarkView」），一行放不下时整体换行堆叠，不让按钮内文字折行 */
.confirm-dialog__actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 20px;
}

.confirm-btn {
    min-width: 72px;
    padding: 7px 16px;
    white-space: nowrap;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: var(--font-size-base);
    font-weight: 600;
    cursor: pointer;
    transition:
        background var(--duration-fast) ease,
        border-color var(--duration-fast) ease,
        color var(--duration-fast) ease,
        transform var(--duration-fast) ease;
}

.confirm-btn:active {
    transform: translateY(1px);
}

.confirm-btn--cancel {
    background: var(--color-surface);
    color: var(--color-muted);
}

.confirm-btn--cancel:hover {
    border-color: var(--color-subtle);
    background: var(--color-surface-soft);
    color: var(--color-text);
}

.confirm-btn--confirm {
    border-color: transparent;
    background: var(--color-accent-solid);
    color: #ffffff;
}

.confirm-btn--confirm:hover {
    background: var(--color-accent);
}

/* danger 语气：删除 / 清空等破坏性操作 */
.confirm-dialog--danger .confirm-btn--confirm {
    background: var(--color-danger);
}

.confirm-dialog--danger .confirm-btn--confirm:hover {
    background: color-mix(in srgb, var(--color-danger) 88%, #000000);
}

.confirm-enter-active,
.confirm-leave-active {
    transition: opacity var(--duration-fast) ease;
}

.confirm-enter-active .confirm-dialog,
.confirm-leave-active .confirm-dialog {
    transition:
        opacity var(--duration-fast) ease,
        transform var(--duration-fast) ease;
}

.confirm-enter-from,
.confirm-leave-to {
    opacity: 0;
}

.confirm-enter-from .confirm-dialog,
.confirm-leave-to .confirm-dialog {
    opacity: 0;
    transform: translateY(8px) scale(0.98);
}
</style>

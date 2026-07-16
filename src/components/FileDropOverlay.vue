<template>
    <Transition name="file-drop-fade">
        <div v-if="visible" class="file-drop-overlay" aria-hidden="true">
            <div class="file-drop-overlay__card">
                <span
                    class="file-drop-overlay__icon"
                    :style="{ '--icon-url': `url(${importFileIcon})` }"
                    aria-hidden="true"
                />
                <p class="file-drop-overlay__title">松开以导入</p>
                <p class="file-drop-overlay__hint">支持 .md / .markdown / .txt 文本文件</p>
            </div>
        </div>
    </Transition>
</template>

<script setup>
import importFileIcon from '../assets/import-file.svg'

defineProps({
    visible: {
        type: Boolean,
        default: false
    }
})
</script>

<style scoped>
/* 蒙层不参与命中：pointer-events: none 让拖拽事件始终落到底层，避免拖过蒙层触发 dragleave 抖动 */
.file-drop-overlay {
    position: fixed;
    inset: 0;
    z-index: 60;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: color-mix(in srgb, var(--color-bg) 70%, transparent);
    backdrop-filter: blur(2px);
    pointer-events: none;
}

.file-drop-overlay__card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 40px 56px;
    border: 2px dashed var(--color-accent);
    border-radius: var(--radius-lg);
    background: var(--color-surface);
    box-shadow: var(--shadow-panel);
    text-align: center;
}

.file-drop-overlay__icon {
    width: 40px;
    height: 40px;
    background: var(--color-accent);
    mask: var(--icon-url) center / contain no-repeat;
    -webkit-mask: var(--icon-url) center / contain no-repeat;
}

.file-drop-overlay__title {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--color-text);
}

.file-drop-overlay__hint {
    margin: 0;
    font-size: 13px;
    color: var(--color-subtle);
}

.file-drop-fade-enter-active,
.file-drop-fade-leave-active {
    transition: opacity 0.14s ease;
}

.file-drop-fade-enter-from,
.file-drop-fade-leave-to {
    opacity: 0;
}
</style>

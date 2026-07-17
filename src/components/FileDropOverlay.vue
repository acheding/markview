<template>
    <Transition name="file-drop-fade">
        <div v-if="visible" class="file-drop-overlay" aria-hidden="true">
            <div class="file-drop-overlay__card">
                <!-- 蚂蚁行军虚线框：SVG rect 描边 + stroke-dashoffset 循环，圆角处虚线仍沿边线流动 -->
                <svg class="file-drop-overlay__ants">
                    <rect class="file-drop-overlay__ants-rect" rx="7" />
                </svg>
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
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 40px 56px;
    border-radius: var(--radius-lg);
    background: var(--color-surface);
    box-shadow: var(--shadow-panel);
    text-align: center;
}

.file-drop-overlay__ants {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
}

.file-drop-overlay__ants-rect {
    /* SVG2 几何属性走 CSS：内缩 1px 让 2px 描边完整落在卡片边缘内 */
    x: 1px;
    y: 1px;
    width: calc(100% - 2px);
    height: calc(100% - 2px);
    fill: none;
    stroke: var(--color-accent);
    stroke-width: 2;
    stroke-dasharray: 8 6;
    animation: file-drop-ants 0.6s linear infinite;
}

@keyframes file-drop-ants {
    to {
        /* 位移一个 dash 周期（8+6），视觉上无缝循环 */
        stroke-dashoffset: -14;
    }
}

.file-drop-overlay__icon {
    width: 40px;
    height: 40px;
    background: var(--color-accent);
    mask: var(--icon-url) center / contain no-repeat;
    -webkit-mask: var(--icon-url) center / contain no-repeat;
    animation: file-drop-float 1.6s ease-in-out infinite;
}

@keyframes file-drop-float {
    50% {
        transform: translateY(-5px);
    }
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

/* 卡片入场：从 0.96 回弹到 1，蒙层本体只做淡入淡出 */
.file-drop-fade-enter-active .file-drop-overlay__card {
    transition: transform 0.24s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.file-drop-fade-enter-from .file-drop-overlay__card {
    transform: scale(0.96);
}

.file-drop-fade-enter-from,
.file-drop-fade-leave-to {
    opacity: 0;
}
</style>

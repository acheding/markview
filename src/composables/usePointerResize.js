import { onBeforeUnmount, ref } from 'vue'

// 通用指针拖拽：统一 pointermove/pointerup 监听、拖拽期间的光标与文本选择抑制。
// 具体的宽度计算由调用方通过 onMove(event) 提供（分栏拖拽、TOC 拖拽各自实现）。
export const usePointerResize = ({ onMove, cursor = 'col-resize' }) => {
    const isActive = ref(false)

    const handleMove = (event) => {
        if (isActive.value) onMove(event)
    }

    const stop = () => {
        if (!isActive.value) return
        isActive.value = false
        document.removeEventListener('pointermove', handleMove)
        document.removeEventListener('pointerup', stop)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
    }

    const start = (event) => {
        event.preventDefault()
        isActive.value = true
        document.addEventListener('pointermove', handleMove)
        document.addEventListener('pointerup', stop)
        document.body.style.cursor = cursor
        document.body.style.userSelect = 'none'
    }

    onBeforeUnmount(stop)

    return { isActive, start, stop }
}

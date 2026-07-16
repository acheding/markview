import { onBeforeUnmount, onMounted, ref } from 'vue'

// 本次拖拽是否携带外部文件（区别于编辑器内的文本拖动 / 页面内元素拖动）。
const isDraggingFiles = (event) => Array.from(event.dataTransfer?.types || []).includes('Files')

// 拖拽中各文件项的 MIME type 快照。此阶段浏览器不暴露文件名，只能读 items 的 type。
const readDragTypes = (event) => {
    const items = event.dataTransfer?.items
    if (!items) return []
    return Array.from(items)
        .filter((item) => item.kind === 'file')
        .map((item) => item.type)
}

// 全局文件拖入：在整窗范围内接收拖入的文件，交给 onDrop(files) 处理。
// isDragging + dragTypes 供消费方决定是否/如何展示放置蒙层（如仅对可导入文本显示）。
// 用进入/离开计数抵消子元素间移动产生的成对 dragenter/dragleave 冒泡，避免蒙层闪烁。
// 本 composable 只负责拖放的 DOM 语义：以 preventDefault 阻止浏览器打开文件，
// 并在 onDrop 返回 true（已消费）时 stopPropagation，抢在捕获阶段拦下 CodeMirror 自身的拖放；
// 「哪些文件可导入 / 如何提示」等业务判断全部交给 onDrop 回调。
export const useFileDrop = ({ onDrop }) => {
    const isDragging = ref(false)
    const dragTypes = ref([])
    let depth = 0

    const reset = () => {
        depth = 0
        isDragging.value = false
        dragTypes.value = []
    }

    const handleDragEnter = (event) => {
        if (!isDraggingFiles(event)) return
        depth += 1
        dragTypes.value = readDragTypes(event)
        isDragging.value = true
    }
    const handleDragOver = (event) => {
        if (!isDraggingFiles(event)) return
        // 必须 preventDefault 才会触发后续 drop，同时阻止浏览器把文件当作导航直接打开。
        event.preventDefault()
    }
    const handleDragLeave = (event) => {
        if (!isDraggingFiles(event)) return
        depth = Math.max(0, depth - 1)
        if (depth === 0) isDragging.value = false
    }
    const handleDrop = (event) => {
        const files = Array.from(event.dataTransfer?.files || [])
        reset()
        // 无外部文件（如编辑器内文本拖动）时完全放行，不干扰默认行为。
        if (!files.length) return
        // 统一阻止浏览器打开/导航到被拖入的文件。
        event.preventDefault()
        // onDrop 返回 true 表示已消费这些文件：拦下冒泡，避免 CodeMirror 把文本再插入编辑器。
        if (onDrop(files)) event.stopPropagation()
    }

    onMounted(() => {
        window.addEventListener('dragenter', handleDragEnter)
        window.addEventListener('dragover', handleDragOver)
        window.addEventListener('dragleave', handleDragLeave)
        window.addEventListener('drop', handleDrop, true)
    })
    onBeforeUnmount(() => {
        window.removeEventListener('dragenter', handleDragEnter)
        window.removeEventListener('dragover', handleDragOver)
        window.removeEventListener('dragleave', handleDragLeave)
        window.removeEventListener('drop', handleDrop, true)
    })

    return { isDragging, dragTypes }
}

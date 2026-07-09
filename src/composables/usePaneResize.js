import { ref, computed, onBeforeUnmount } from 'vue'
import { clamp } from '../utils/text'

const MIN_PANEL_WIDTH = 22
const MAX_PANEL_WIDTH = 78
const DIVIDER_WIDTH = 6

const createBalancedEditorWidth = () => `calc((100% - var(--toc-width, 220px) - ${DIVIDER_WIDTH}px) / 2)`
const createBalancedPreviewWidth = () => `calc((100% + var(--toc-width, 220px) - ${DIVIDER_WIDTH}px) / 2)`

export const usePaneResize = (containerRef) => {
    const isResizing = ref(false)
    const editorWidth = ref(createBalancedEditorWidth())
    const previewWidth = computed(() =>
        typeof editorWidth.value === 'number' ? `${100 - editorWidth.value}%` : createBalancedPreviewWidth()
    )

    const onResize = (event) => {
        if (!isResizing.value || !containerRef.value) return

        const rect = containerRef.value.getBoundingClientRect()
        const nextWidth = ((event.clientX - rect.left) / rect.width) * 100
        editorWidth.value = clamp(nextWidth, MIN_PANEL_WIDTH, MAX_PANEL_WIDTH)
    }

    const stopResize = () => {
        isResizing.value = false
        document.removeEventListener('pointermove', onResize)
        document.removeEventListener('pointerup', stopResize)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
    }

    const startResize = (event) => {
        event.preventDefault()
        isResizing.value = true
        document.addEventListener('pointermove', onResize)
        document.addEventListener('pointerup', stopResize)
        document.body.style.cursor = 'col-resize'
        document.body.style.userSelect = 'none'
    }

    onBeforeUnmount(stopResize)

    return {
        editorWidth,
        previewWidth,
        isResizing,
        startResize
    }
}

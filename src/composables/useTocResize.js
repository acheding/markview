import { ref, computed, onBeforeUnmount, onMounted } from 'vue'
import { clamp } from '../utils/text'

const MIN_TOC_WIDTH = 160
const MAX_TOC_WIDTH = 360

export const useTocResize = () => {
    const isTocResizing = ref(false)
    const isTocVisible = ref(true)
    const tocWidth = ref(220)
    const tocWidthStyle = computed(() => (isTocVisible.value ? `${tocWidth.value}px` : '0px'))
    let mediaQuery = null

    const syncTocVisibility = () => {
        isTocVisible.value = mediaQuery ? mediaQuery.matches : true
    }

    const onResize = (event) => {
        if (!isTocResizing.value) return

        const nextWidth = window.innerWidth - event.clientX
        tocWidth.value = clamp(nextWidth, MIN_TOC_WIDTH, MAX_TOC_WIDTH)
    }

    const stopResize = () => {
        isTocResizing.value = false
        document.removeEventListener('pointermove', onResize)
        document.removeEventListener('pointerup', stopResize)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
    }

    const startTocResize = (event) => {
        if (!isTocVisible.value) return

        event.preventDefault()
        isTocResizing.value = true
        document.addEventListener('pointermove', onResize)
        document.addEventListener('pointerup', stopResize)
        document.body.style.cursor = 'col-resize'
        document.body.style.userSelect = 'none'
    }

    onMounted(() => {
        mediaQuery = window.matchMedia('(min-width: 901px)')
        syncTocVisibility()
        mediaQuery.addEventListener('change', syncTocVisibility)
    })

    onBeforeUnmount(() => {
        stopResize()
        mediaQuery?.removeEventListener('change', syncTocVisibility)
    })

    return {
        tocWidth,
        tocWidthStyle,
        isTocResizing,
        startTocResize
    }
}

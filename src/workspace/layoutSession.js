import { computed, ref } from 'vue'
import { clamp } from '../core/text.js'
import { useLocalStoragePreference } from '../composables/useLocalStoragePreference.js'
import { useMediaQuery } from '../composables/useMediaQuery.js'
import { usePointerResize } from '../composables/usePointerResize.js'

const EDITOR_COLLAPSED_STORAGE_KEY = 'markview:editor-collapsed'
const MIN_PANEL_WIDTH = 22
const MAX_PANEL_WIDTH = 78
const DIVIDER_WIDTH = 6
const MIN_TOC_WIDTH = 160
const MAX_TOC_WIDTH = 360
const DEFAULT_TOC_WIDTH = 220

const balancedEditorWidth = () => `calc((100% - var(--toc-width, 220px) - ${DIVIDER_WIDTH}px) / 2)`
const balancedPreviewWidth = () => `calc((100% + var(--toc-width, 220px) - ${DIVIDER_WIDTH}px) / 2)`

// 布局响应式会话：编辑区折叠、分栏宽度、TOC 宽度、断点可见性。
// 折叠动画期间的时序编排（focus / requestMeasure / 恢复同步）在 orchestrations 层完成。
export const createLayoutSession = () => {
    // 主面板元素（分栏拖拽需要其宽度）；由 App 通过函数 ref 注入。
    const containerRef = ref(null)
    // 编辑面板根元素（折叠过渡结束的等待目标）；由 EditorPane 注入。
    const editorPanelRef = ref(null)

    const isEditorCollapsed = useLocalStoragePreference(EDITOR_COLLAPSED_STORAGE_KEY, false)
    const isScrollSyncEnabled = ref(!isEditorCollapsed.value)

    // —— 分栏宽度 ——
    const editorWidth = ref(balancedEditorWidth())
    const previewWidth = computed(() =>
        typeof editorWidth.value === 'number' ? `${100 - editorWidth.value}%` : balancedPreviewWidth()
    )
    const paneResize = usePointerResize({
        onMove: (event) => {
            const container = containerRef.value
            if (!container) return
            const rect = container.getBoundingClientRect()
            const nextWidth = ((event.clientX - rect.left) / rect.width) * 100
            editorWidth.value = clamp(nextWidth, MIN_PANEL_WIDTH, MAX_PANEL_WIDTH)
        }
    })

    // —— TOC 宽度 ——
    const isTocVisible = useMediaQuery('(min-width: 901px)', true)
    const tocWidth = ref(DEFAULT_TOC_WIDTH)
    const tocWidthStyle = computed(() => (isTocVisible.value ? `${tocWidth.value}px` : '0px'))
    const tocResize = usePointerResize({
        onMove: (event) => {
            tocWidth.value = clamp(window.innerWidth - event.clientX, MIN_TOC_WIDTH, MAX_TOC_WIDTH)
        }
    })
    const startTocResize = (event) => {
        if (isTocVisible.value) tocResize.start(event)
    }

    return {
        containerRef,
        editorPanelRef,
        isEditorCollapsed,
        isScrollSyncEnabled,

        editorWidth,
        previewWidth,
        isResizing: paneResize.isActive,
        startResize: paneResize.start,

        tocWidth,
        tocWidthStyle,
        isTocResizing: tocResize.isActive,
        startTocResize,

        setCollapsed(value) {
            isEditorCollapsed.value = value
        },
        setScrollSyncEnabled(value) {
            isScrollSyncEnabled.value = value
        }
    }
}

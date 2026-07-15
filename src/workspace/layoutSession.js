import { computed, ref } from 'vue'
import { clamp } from '../core/text.js'
import { useLocalStoragePreference } from '../composables/useLocalStoragePreference.js'
import { useMediaQuery } from '../composables/useMediaQuery.js'
import { usePointerResize } from '../composables/usePointerResize.js'

const EDITOR_COLLAPSED_STORAGE_KEY = 'markview:editor-collapsed'
const EDITOR_WIDTH_STORAGE_KEY = 'markview:editor-width'
const TOC_WIDTH_STORAGE_KEY = 'markview:toc-width'
// 编辑区与预览内容区（不含目录）共用的最小像素宽度；同时供 CSS 兜底（--min-pane-width）。
const MIN_PANE_WIDTH = 300
const DIVIDER_WIDTH = 1
const MIN_TOC_WIDTH = 160
const MAX_TOC_WIDTH = 360
const DEFAULT_TOC_WIDTH = 220

// editorWidth 三态：null=默认均分（下方 balanced 布局，编辑区≈预览内容区，纯 CSS 无需测量）；
// number=用户拖拽后的编辑区像素宽度。下限取 MIN_PANE_WIDTH：既拒绝被篡改的过小值，
// 也让上一版遗留的百分比语义值（22~78）自动回退默认，无需单独的迁移逻辑。
const isPaneWidth = (value) => typeof value === 'number' && Number.isFinite(value) && value >= MIN_PANE_WIDTH

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

    // TOC 是否可见（>900px）；分栏拖拽的可用宽度需扣除 TOC。此处先声明，供下方 onMove 引用。
    const isTocVisible = useMediaQuery('(min-width: 901px)', true)

    // —— 分栏宽度 ——
    // 编辑区宽度持久化到 localStorage：null=默认均分布局，number=编辑区像素宽度。
    const editorWidth = useLocalStoragePreference(EDITOR_WIDTH_STORAGE_KEY, null)
    // 读回值健壮性：非合法像素（含旧版遗留的百分比语义值）一律回退默认均分。
    if (!isPaneWidth(editorWidth.value)) editorWidth.value = null

    // 编辑区宽度样式：默认走 balanced calc（自适应 TOC 宽度），拖拽后走绝对像素。
    const editorWidthStyle = computed(() =>
        isPaneWidth(editorWidth.value) ? `${editorWidth.value}px` : balancedEditorWidth()
    )
    // 预览区吃「编辑区之外的剩余」，其内部再由 CSS 拆成预览内容(flex) + 目录(像素)。
    const previewWidth = computed(() =>
        isPaneWidth(editorWidth.value)
            ? `calc(100% - ${editorWidth.value}px - ${DIVIDER_WIDTH}px)`
            : balancedPreviewWidth()
    )
    const paneResize = usePointerResize({
        onMove: (event) => {
            const container = containerRef.value
            if (!container) return
            const rect = container.getBoundingClientRect()
            const tocPx = isTocVisible.value ? tocWidth.value : 0
            // 拖拽点即编辑区右边界；上限保证预览内容区（扣除 TOC 与两条分隔线）不小于最小宽度。
            const maxEditor = rect.width - tocPx - DIVIDER_WIDTH * 2 - MIN_PANE_WIDTH
            editorWidth.value = clamp(event.clientX - rect.left, MIN_PANE_WIDTH, Math.max(MIN_PANE_WIDTH, maxEditor))
        }
    })

    // —— TOC 宽度 ——
    // 持久化到 localStorage；读回值 clamp 回合法区间，异常则回退默认。
    const tocWidth = useLocalStoragePreference(TOC_WIDTH_STORAGE_KEY, DEFAULT_TOC_WIDTH)
    tocWidth.value = Number.isFinite(tocWidth.value)
        ? clamp(tocWidth.value, MIN_TOC_WIDTH, MAX_TOC_WIDTH)
        : DEFAULT_TOC_WIDTH
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
        editorWidthStyle,
        previewWidth,
        minPaneWidth: MIN_PANE_WIDTH,
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

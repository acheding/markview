import { computed, onBeforeUnmount, ref, watch } from 'vue'
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
    // 预览布局元素 [内容 | 分隔线 | 目录] 的容器；目录拖拽据其实际宽度约束目录上限。由 PreviewPane 注入。
    const previewLayoutRef = ref(null)

    // 主面板内容区实宽（content-box，不含 border/margin）；随窗口/DevTools 变化实时更新，
    // 供目录宽度按可用空间收缩，从源头杜绝窄屏目录横向溢出。0 表示尚未测量。
    const containerWidth = ref(0)
    let containerObserver = null
    watch(
        containerRef,
        (el) => {
            containerObserver?.disconnect()
            if (!el) {
                containerWidth.value = 0
                return
            }
            containerObserver = new ResizeObserver((entries) => {
                containerWidth.value = entries[0].contentRect.width
            })
            containerObserver.observe(el)
        },
        { immediate: true }
    )
    onBeforeUnmount(() => containerObserver?.disconnect())

    const isEditorCollapsed = useLocalStoragePreference(EDITOR_COLLAPSED_STORAGE_KEY, false)
    const isScrollSyncEnabled = ref(!isEditorCollapsed.value)

    // TOC 是否可见（>900px）；分栏拖拽的可用宽度需扣除 TOC。此处先声明，供下方 onMove 引用。
    const isTocVisible = useMediaQuery('(min-width: 901px)', true)
    // 窄屏（≤768px）纵向堆叠：编辑区/预览区固定分屏，横向分栏拖拽在此失效——
    // 既无视觉效果（pane 宽度被 100% 覆盖），又会静默污染 editorWidth 并持久化，故守卫掉。
    const isStacked = useMediaQuery('(max-width: 768px)', false)

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
    // 纵向堆叠时不启动横向拖拽（与 startTocResize 用 isTocVisible 守卫同理）。
    const startResize = (event) => {
        if (!isStacked.value) paneResize.start(event)
    }

    // —— TOC 宽度 ——
    // 持久化到 localStorage；读回值 clamp 回合法区间，异常则回退默认。
    const tocWidth = useLocalStoragePreference(TOC_WIDTH_STORAGE_KEY, DEFAULT_TOC_WIDTH)
    tocWidth.value = Number.isFinite(tocWidth.value)
        ? clamp(tocWidth.value, MIN_TOC_WIDTH, MAX_TOC_WIDTH)
        : DEFAULT_TOC_WIDTH
    // 目录显示宽 = min(存储值, 可用空间)。可用空间 = 容器实宽扣除 编辑区最小 + 预览内容最小 + 两条分隔线，
    // 剩下才留给目录。宽屏时可用空间充裕→保留用户存储值；窗口收窄时目录随之收缩，preview-panel 外边界不再被撑破。
    const tocWidthStyle = computed(() => {
        if (!isTocVisible.value) return '0px'
        const w = containerWidth.value
        if (!w) return `${tocWidth.value}px` // 测量前回退存储值，避免首帧闪烁
        const maxToc = w - MIN_PANE_WIDTH * 2 - DIVIDER_WIDTH * 2
        return `${Math.max(0, Math.min(tocWidth.value, maxToc))}px`
    })
    const tocResize = usePointerResize({
        onMove: (event) => {
            const el = previewLayoutRef.value
            if (!el) return
            const rect = el.getBoundingClientRect()
            // 目录右缘贴预览区右侧（rect.right 已含 margin，比 window.innerWidth 更准）。
            // 上限保证预览内容区（扣除分隔线）不小于最小宽度，使目录永远拖不到需要跨面板重排的程度——
            // 预览面板外边界因此在拖拽中恒定，从源头消除窄屏抽搐。
            const maxToc = Math.min(MAX_TOC_WIDTH, rect.width - DIVIDER_WIDTH - MIN_PANE_WIDTH)
            tocWidth.value = clamp(rect.right - event.clientX, MIN_TOC_WIDTH, Math.max(MIN_TOC_WIDTH, maxToc))
        }
    })
    const startTocResize = (event) => {
        if (isTocVisible.value) tocResize.start(event)
    }

    return {
        containerRef,
        editorPanelRef,
        previewLayoutRef,
        isEditorCollapsed,
        isScrollSyncEnabled,

        editorWidth,
        editorWidthStyle,
        previewWidth,
        minPaneWidth: MIN_PANE_WIDTH,
        isResizing: paneResize.isActive,
        startResize,
        isStacked,

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

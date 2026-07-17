import { nextTick } from 'vue'
import { waitForAnimationFrame, waitForTransition } from '../composables/useTransitionSettled.js'

const TRANSITION_PROPERTIES = ['width', 'min-width', 'height', 'min-height']
const SEARCH_VIEWPORT_RATIO = 0.3

/**
 * 横切编排层：凡是需要多个子系统（文档/编辑器/预览/滚动/布局/标题）按顺序协作的流程，
 * 都收敛到这里的具名 async 函数。这是唯一允许命令式调用 controller 并 await 时序的地方，
 * 把原先散落在 App.vue 里的密集 nextTick 逻辑集中且可读化。
 */
export const createOrchestrations = ({
    documents,
    search,
    layout,
    headings,
    confirm,
    getEditor,
    getPreview,
    getScrollMaster,
    waitForPreviewReady
}) => {
    let collapseRunId = 0
    let searchRunId = 0

    // 把当前搜索命中重新定位并高亮（展开编辑区后、或选中搜索结果时复用）。
    const revealActiveLine = async () => {
        const match = search.activeMatch.value
        if (!match || !Number.isFinite(match.lineNumber)) return false

        const editor = getEditor()
        const preview = getPreview()
        const line = match.lineNumber
        const revealOptions = {
            match: { from: match.from, to: match.to },
            query: match.query,
            select: true,
            focus: !layout.isEditorCollapsed.value
        }

        if (layout.isEditorCollapsed.value) {
            editor?.revealLine(line, { ...revealOptions, scroll: false })
            preview?.scrollToSourceLine(line, { behavior: 'auto', viewportRatio: SEARCH_VIEWPORT_RATIO })
            return true
        }

        const editorTop = await editor?.revealLineMeasured(line, {
            ...revealOptions,
            viewportRatio: SEARCH_VIEWPORT_RATIO
        })
        if (search.activeMatch.value !== match) return false

        const previewTop = preview?.scrollTopForSourceLine(line, { viewportRatio: SEARCH_VIEWPORT_RATIO })
        const aligned = getScrollMaster()?.alignToScrollTops(editorTop, previewTop)
        if (!aligned) {
            preview?.scrollToSourceLine(line, { behavior: 'auto', viewportRatio: SEARCH_VIEWPORT_RATIO })
        }
        return true
    }

    // 选中全局搜索结果：切文档 → 定位 → 编辑/预览双侧高亮。
    const revealSearchResult = async (result) => {
        const runId = ++searchRunId
        documents.select(result.fileId)
        await nextTick()
        if (runId !== searchRunId) return

        if (result.kind === 'line' && Number.isFinite(result.lineNumber)) {
            if (!(await waitForPreviewReady()) || runId !== searchRunId) return

            search.setActiveMatch(result)
            await nextTick()
            if (runId !== searchRunId) return

            await revealActiveLine()
            if (runId !== searchRunId) return

            if (layout.isEditorCollapsed.value) {
                getPreview()?.focus()
                headings.updateActiveHeading()
            }
        } else {
            search.clearActiveMatch()
            if (layout.isEditorCollapsed.value) getPreview()?.focus()
            else getEditor()?.focus()
        }
    }

    // 折叠/展开编辑区：过渡期间暂停滚动同步，展开后重测量并恢复，再复位搜索命中。
    const setEditorCollapsed = async (collapsed) => {
        const runId = ++collapseRunId
        layout.setScrollSyncEnabled(false)
        layout.setCollapsed(collapsed)
        await nextTick()

        if (collapsed) {
            getPreview()?.focus()
            headings.updateActiveHeading()
            return
        }

        getEditor()?.focus({ preventScroll: true })
        await waitForTransition(layout.editorPanelRef.value, TRANSITION_PROPERTIES)
        if (runId !== collapseRunId || layout.isEditorCollapsed.value) return

        // 容器尺寸稳定后 CodeMirror 重测量，下一帧再恢复滚动同步。
        getEditor()?.refresh()
        await waitForAnimationFrame()
        if (runId !== collapseRunId || layout.isEditorCollapsed.value) return

        layout.setScrollSyncEnabled(true)
        await revealActiveLine()
        headings.updateActiveHeading()
    }

    // 打开编辑器内查找替换：编辑区折叠时先展开（复用折叠编排的完整时序），再唤起面板。
    const openFindPanel = async () => {
        if (layout.isEditorCollapsed.value) await setEditorCollapsed(false)
        getEditor()?.openSearch()
    }

    const clearContent = async () => {
        const ok = await confirm.ask({
            title: '清空内容',
            message: '确定要清空当前文档的所有内容吗？此操作可撤销（Ctrl + Z）。',
            confirmLabel: '清空',
            tone: 'danger'
        })
        if (!ok) return

        search.clearActiveMatch()
        documents.clearContent()
        // 编辑器不再随 content 自动同步（切文档走 setActiveDocument），此处显式清空为可撤销的文档内编辑。
        getEditor()?.setDoc('')
        await nextTick()
        getEditor()?.focus()
    }

    return {
        revealActiveLine,
        revealSearchResult,
        setEditorCollapsed,
        openFindPanel,
        clearContent
    }
}

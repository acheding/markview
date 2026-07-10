import { clamp } from '../text.js'
import { interpolate } from './anchorMap.js'

/**
 * 编辑区 ↔ 预览区双向滚动同步的防回环状态机。
 *
 * 机制：期望值回声队列。每次程序滚动把目标 scrollTop 入队后再执行滚动；
 * scroll 事件到达时若与队头匹配（±ε）则视为「回声」，核销后直接返回，绝不反向传播；
 * 不匹配则说明是用户抢占滚动，清空队列并单向传播插值结果。
 * 由此回环链长度严格为 1，且不依赖任何定时器或事件来源猜测。
 *
 * PaneAdapter 接口（DOM 依赖注入，便于单测）：
 *   { getScrollTop(), getMaxScrollTop(), getClientHeight(), setScrollTop(top) }
 */
const SCROLL_EPSILON = 2

export const createScrollMaster = ({ editor, preview, getAnchors, isEnabled = () => true }) => {
    const panes = { editor, preview }
    const expected = { editor: [], preview: [] }

    const otherOf = (name) => (name === 'editor' ? 'preview' : 'editor')

    // 程序滚动：目标值先入队再滚动；已在目标位置则不滚也不入队（不会产生 scroll 事件）。
    const programmaticScroll = (name, top) => {
        const pane = panes[name]
        const target = clamp(Math.round(top), 0, pane.getMaxScrollTop())
        if (Math.abs(pane.getScrollTop() - target) <= SCROLL_EPSILON) return false

        expected[name].push(target)
        pane.setScrollTop(target)
        return true
    }

    const handleScroll = (name) => {
        const queue = expected[name]
        const current = panes[name].getScrollTop()

        // 匹配队列中任一期望值即视为程序滚动的回声。浏览器可能把一帧内多次 scrollTo
        // 合并成一个落在最终值的 scroll 事件，此时最终值命中队尾；逐次派发时则命中队首。
        // 命中后丢弃到该目标为止，核销并终止，不向对侧传播。
        const echoIndex = queue.findIndex((target) => Math.abs(target - current) <= SCROLL_EPSILON)
        if (echoIndex >= 0) {
            queue.splice(0, echoIndex + 1)
            return
        }

        // 用户抢占：作废尚未到达的旧期望，恢复用户主导。
        queue.length = 0

        if (!isEnabled()) return

        const anchors = getAnchors()
        if (!anchors?.length) return

        const other = otherOf(name)
        programmaticScroll(other, interpolate(anchors, name, other, current))
    }

    // 把两侧一次性对齐到编辑区指定行的像素偏移（用于搜索定位）。
    // 编辑区按视口比例定位，预览区用锚点映射跟随，两个期望值各自核销，天然不与联动竞争。
    const alignToEditorTop = (editorLineTop, { viewportRatio = 0.3 } = {}) => {
        if (!isEnabled() || !Number.isFinite(editorLineTop)) return

        const editorTarget = Math.max(0, editorLineTop - panes.editor.getClientHeight() * viewportRatio)
        programmaticScroll('editor', editorTarget)

        const anchors = getAnchors()
        if (!anchors?.length) return

        programmaticScroll('preview', interpolate(anchors, 'editor', 'preview', editorTarget))
    }

    // 清空两侧期望值队列。用于导航锁释放时，丢弃跟随侧积累的未核销期望，避免后续误判。
    const reset = () => {
        expected.editor.length = 0
        expected.preview.length = 0
    }

    return {
        handleScroll,
        alignToEditorTop,
        reset
    }
}

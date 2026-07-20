import { clamp } from '../core/text.js'
import { applyPreviewHighlight, clearPreviewHighlight } from './previewSearchHighlight.js'

/**
 * 预览 DOM 门面：封装源行块解析、滚动定位、搜索高亮。
 * data-source-line 契约由 renderMarkdown（生产方）与这里（消费方）闭环，Vue 组件不感知该属性。
 *
 * @param {object} options
 * @param {HTMLElement} options.contentEl  预览滚动容器（v-html 宿主）
 */
export const createPreviewController = ({ contentEl }) => {
    let blockCache = null

    // 解析所有 [data-source-line] 块，按行号升序，带缓存（html 更新时 invalidate 失效）。
    // contentLine = 渲染文本首行对应的源码行：代码类块由 data-source-content-line 声明
    //（围栏行不进渲染文本），其余块未声明时即块首行。
    const sourceBlocks = () => {
        if (blockCache) return blockCache

        blockCache = Array.from(contentEl.querySelectorAll('[data-source-line]'))
            .map((element) => {
                const line = Number(element.dataset.sourceLine)
                const contentLine = Number(element.dataset.sourceContentLine)
                return { element, line, contentLine: Number.isFinite(contentLine) ? contentLine : line }
            })
            .filter((item) => Number.isFinite(item.line))

        return blockCache
    }

    // 源行 ≤ 目标行的最后一个块记录（含下一块，供块内插值对照）。
    // 目标行在首块之前时取首块；行号无效或没有块时返回 null。
    const blockRecordForLine = (lineNumber) => {
        const line = Number(lineNumber)
        const blocks = sourceBlocks()
        if (!Number.isFinite(line) || !blocks.length) return null

        const index = Math.max(
            0,
            blocks.findLastIndex((block) => block.line <= line)
        )
        return { ...blocks[index], next: blocks[index + 1] ?? null }
    }

    // 源行的定位目标：所在块 + 块内像素偏移。偏移在「本块顶 → 下一块顶」之间按
    // 源码行占比线性分摊——与滚动同步锚点表的分段线性是同一种近似，长代码块内
    // 也能落到目标行附近，而不是一律停在块顶。末块没有下一块可对照，退回块顶
    //（此时滚动会被 clamp 在文档底部附近，误差以视口为界）。
    const locateSourceLine = (lineNumber) => {
        const record = blockRecordForLine(lineNumber)
        if (!record) return { target: null, offset: 0 }

        const { element, line, next } = record
        if (!next || next.line <= line) return { target: element, offset: 0 }

        const fraction = clamp((Number(lineNumber) - line) / (next.line - line), 0, 1)
        const span = next.element.getBoundingClientRect().top - element.getBoundingClientRect().top
        return { target: element, offset: Math.max(0, span) * fraction }
    }

    const scrollTopForElement = (target, options = {}) => {
        if (!target) return Number.NaN

        const contentRect = contentEl.getBoundingClientRect()
        const targetRect = target.getBoundingClientRect()
        const viewportOffset = contentEl.clientHeight * (options.viewportRatio || 0)
        return contentEl.scrollTop + targetRect.top - contentRect.top - viewportOffset - (options.offset || 0)
    }

    const scrollToPosition = (top, options = {}) => {
        if (!Number.isFinite(top)) return false

        contentEl.scrollTo({ top, behavior: options.behavior || 'smooth' })
        return true
    }

    const scrollToElement = (target, options = {}) => scrollToPosition(scrollTopForElement(target, options), options)

    // 源行的目标 scrollTop：块顶定位再叠加块内插值偏移（见 locateSourceLine）。
    const scrollTopForSourceLine = (lineNumber, options = {}) => {
        const { target, offset } = locateSourceLine(lineNumber)
        return scrollTopForElement(target, options) + offset
    }

    // 预测：把 target 定位到位是否会真正改变 scrollTop（目标 top 经 clamp 后与当前比较）。
    // 与 scrollToElement 共用 scrollTopForElement，「预测」与「执行」的目标数学不会漂移。
    const willScrollToElement = (target, options = {}) => {
        const top = scrollTopForElement(target, options)
        if (!Number.isFinite(top)) return false

        const maxTop = Math.max(0, contentEl.scrollHeight - contentEl.clientHeight)
        const clamped = Math.min(Math.max(top, 0), maxTop)
        return Math.abs(clamped - contentEl.scrollTop) > 1
    }

    const captureViewport = () => {
        const contentRect = contentEl.getBoundingClientRect()
        const blocks = sourceBlocks()
        const visibleBlock =
            blocks.find(({ element }) => element.getBoundingClientRect().bottom > contentRect.top) ?? blocks.at(-1)

        if (!visibleBlock) return { line: null, offset: 0, scrollTop: contentEl.scrollTop }

        return {
            line: visibleBlock.line,
            offset: visibleBlock.element.getBoundingClientRect().top - contentRect.top,
            scrollTop: contentEl.scrollTop
        }
    }

    const restoreViewport = (snapshot) => {
        if (!snapshot) return false

        const target = blockRecordForLine(snapshot.line)?.element ?? null
        const top = target ? scrollTopForElement(target, { offset: snapshot.offset }) : Number(snapshot.scrollTop)
        if (!Number.isFinite(top)) return false

        contentEl.scrollTo({ top, behavior: 'auto' })
        return true
    }

    return {
        get scrollDOM() {
            return contentEl
        },

        sourceBlocks,

        captureViewport,
        restoreViewport,

        scrollToSourceLine: (lineNumber, options = {}) =>
            scrollToPosition(scrollTopForSourceLine(lineNumber, options), options),

        scrollTopForSourceLine,

        scrollToHeading: (id, options) => scrollToElement(contentEl.querySelector(`#${CSS.escape(id)}`), options),

        // 该标题点击后是否会真正滚动（末尾同屏等场景会被 clamp 成不滚动）。
        willScrollToHeading: (id, options) =>
            willScrollToElement(contentEl.querySelector(`#${CSS.escape(id)}`), options),

        scrollToTop: () => contentEl.scrollTo({ top: 0, behavior: 'smooth' }),

        // 搜索高亮：match = { lineNumber, from, query } 或 null（清除）
        setSearchHighlight(match) {
            const block = match ? blockRecordForLine(match.lineNumber) : null
            if (!block) {
                clearPreviewHighlight(contentEl)
                return
            }

            // 锚点 = 命中行在渲染文本中的行下标（相对内容起始行）+ 行内列偏移，
            // 供块内多处同词命中时选中正确的那处（多行代码块最典型）。
            const anchor = { relativeLine: match.lineNumber - block.contentLine, column: match.from ?? 0 }
            applyPreviewHighlight(contentEl, block.element, match.query, anchor)
        },

        focus: () => contentEl.focus({ preventScroll: true }),

        // html 更新后调用：源行块缓存失效。
        invalidate() {
            blockCache = null
        }
    }
}

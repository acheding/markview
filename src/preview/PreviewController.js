import { renderMermaidDiagrams } from './mermaidRenderer.js'
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
    const sourceBlocks = () => {
        if (blockCache) return blockCache

        blockCache = Array.from(contentEl.querySelectorAll('[data-source-line]'))
            .map((element) => ({ element, line: Number(element.dataset.sourceLine) }))
            .filter((item) => Number.isFinite(item.line))

        return blockCache
    }

    // 找到源行 ≤ 目标行的最后一个块。
    const blockForLine = (lineNumber) => {
        const line = Number(lineNumber)
        const blocks = sourceBlocks()
        if (!Number.isFinite(line) || !blocks.length) return null

        let target = blocks[0].element
        for (const item of blocks) {
            if (item.line <= line) target = item.element
            else break
        }
        return target
    }

    const scrollToElement = (target, options = {}) => {
        if (!target) return false

        const contentRect = contentEl.getBoundingClientRect()
        const targetRect = target.getBoundingClientRect()
        const viewportOffset = contentEl.clientHeight * (options.viewportRatio || 0)
        const top = contentEl.scrollTop + targetRect.top - contentRect.top - viewportOffset - (options.offset || 0)

        contentEl.scrollTo({ top, behavior: options.behavior || 'smooth' })
        return true
    }

    return {
        get scrollDOM() {
            return contentEl
        },

        sourceBlocks,
        blockForLine,

        scrollToSourceLine: (lineNumber, options) => scrollToElement(blockForLine(lineNumber), options),

        scrollToHeading: (id, options) => scrollToElement(contentEl.querySelector(`#${CSS.escape(id)}`), options),

        scrollToTop: () => contentEl.scrollTo({ top: 0, behavior: 'smooth' }),

        // 搜索高亮：match = { lineNumber, query } 或 null（清除）
        setSearchHighlight(match) {
            if (match && Number.isFinite(match.lineNumber)) {
                applyPreviewHighlight(contentEl, blockForLine(match.lineNumber), match.query)
            } else {
                clearPreviewHighlight(contentEl)
            }
        },

        focus: () => contentEl.focus({ preventScroll: true }),

        // 异步渲染预览区内的 Mermaid 图表（html 更新后、主题切换后调用）。
        renderDiagrams: (theme) => renderMermaidDiagrams(contentEl, theme),

        // html 更新后调用：源行块缓存失效。
        invalidate() {
            blockCache = null
        }
    }
}

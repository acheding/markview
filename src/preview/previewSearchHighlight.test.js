import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { applyPreviewHighlight } from './previewSearchHighlight.js'

const HIGHLIGHT_NAME = 'markview-search'
const FALLBACK_CLASS = 'is-search-highlight'

// 手搓一个够用的 DOM：文本节点带 data / parentElement.closest，
// TreeWalker + Range + CSS.highlights 全部 mock，运行在 node 环境。
const makeClassList = () => {
    const set = new Set()
    return {
        add: (c) => set.add(c),
        remove: (c) => set.delete(c),
        contains: (c) => set.has(c),
        forEach: (fn) => set.forEach(fn)
    }
}

const makeParent = (selectors = []) => ({
    closest: (sel) => (selectors.includes(sel) ? {} : null)
})

// nodes: [{ text, parentSelectors }]，target 会记住这些文本节点供 TreeWalker 吐出。
const makeTarget = (nodes) => {
    const textNodes = nodes.map(({ text, parentSelectors }) => ({
        data: text,
        parentElement: makeParent(parentSelectors)
    }))
    return { classList: makeClassList(), __textNodes: textNodes }
}

let currentHighlights

beforeEach(() => {
    currentHighlights = new Map()

    class Highlight {
        constructor(...ranges) {
            this.ranges = ranges
        }
    }

    global.window = { CSS: { highlights: currentHighlights }, Highlight }
    global.NodeFilter = { SHOW_TEXT: 4 }
    global.document = {
        createTreeWalker: (root) => {
            let index = -1
            return {
                nextNode: () => {
                    index += 1
                    return root.__textNodes[index] ?? null
                }
            }
        },
        createRange: () => {
            const range = {
                setStart(node, offset) {
                    range.startContainer = node
                    range.startOffset = offset
                },
                setEnd(node, offset) {
                    range.endContainer = node
                    range.endOffset = offset
                }
            }
            return range
        }
    }
})

afterEach(() => {
    delete global.window
    delete global.document
    delete global.NodeFilter
})

const contentEl = { querySelectorAll: () => [] }

describe('applyPreviewHighlight', () => {
    it('普通文本命中：注册到 CSS Custom Highlight，不加降级 outline', () => {
        const target = makeTarget([
            { text: 'Hello ', parentSelectors: [] },
            { text: 'Markdown', parentSelectors: [] }
        ])

        applyPreviewHighlight(contentEl, target, 'markdown')

        expect(currentHighlights.has(HIGHLIGHT_NAME)).toBe(true)
        expect(currentHighlights.get(HIGHLIGHT_NAME).ranges).toHaveLength(1)
        expect(target.classList.contains(FALLBACK_CLASS)).toBe(false)
    })

    it('命中落在 SVG 原生文本（<text>）：不注册 Highlight，改为整块 outline 降级', () => {
        const target = makeTarget([{ text: '按需加载 mermaid', parentSelectors: ['svg'] }])

        applyPreviewHighlight(contentEl, target, 'mermaid')

        // Highlight API 画不了 SVG 原生文本，收集阶段被排除后无命中，highlights 不应留下条目。
        expect(currentHighlights.has(HIGHLIGHT_NAME)).toBe(false)
        expect(target.classList.contains(FALLBACK_CLASS)).toBe(true)
    })

    it('命中落在 mermaid 的 foreignObject（HTML 文本）：仍走 Highlight API 逐词高亮', () => {
        // foreignObject 内是真 HTML，Highlight API 能绘制，不应被当作 SVG 文本剔除。
        const target = makeTarget([{ text: '按需加载 mermaid', parentSelectors: ['svg', 'foreignObject'] }])

        applyPreviewHighlight(contentEl, target, 'mermaid')

        expect(currentHighlights.has(HIGHLIGHT_NAME)).toBe(true)
        expect(currentHighlights.get(HIGHLIGHT_NAME).ranges).toHaveLength(1)
        expect(target.classList.contains(FALLBACK_CLASS)).toBe(false)
    })

    it('命中不被 SVG <style> 里的 mermaid 字样劫持：优先落在 foreignObject 标签', () => {
        // 复现真实 bug：mermaid 把含 "mermaid" 的 <style>（svg 内、非 foreignObject）排在最前。
        // 若它参与匹配，第一个命中会落到画不了的 style 节点 → 整块只剩 outline。
        const target = makeTarget([
            { text: '#mmd-1{font-family:mermaid}', parentSelectors: ['svg'] },
            { text: '是 mermaid 代码块？', parentSelectors: ['svg', 'foreignObject'] }
        ])

        applyPreviewHighlight(contentEl, target, 'mermaid')

        expect(currentHighlights.has(HIGHLIGHT_NAME)).toBe(true)
        expect(currentHighlights.get(HIGHLIGHT_NAME).ranges).toHaveLength(1)
        expect(target.classList.contains(FALLBACK_CLASS)).toBe(false)
    })

    it('块内多行同词命中：按锚点（相对行 + 列）选中对应行的那一处，而非首个', () => {
        // 模拟代码块：围栏行占 relativeLine 0，渲染文本从内容首行开始。
        // "ni" 在第 1 行 "denied"（列 8）与第 2 行 "warning"（列 10）各有一处命中。
        const target = makeTarget([{ text: "const denied = 1\ntoast('warning')", parentSelectors: [] }])

        applyPreviewHighlight(contentEl, target, 'ni', { relativeLine: 2, column: 10 })

        const ranges = currentHighlights.get(HIGHLIGHT_NAME).ranges
        expect(ranges).toHaveLength(1)
        // 全局偏移 = 第 2 行起点 17 + 列 10，落在 "warning" 的 "ni" 上，而非 "denied" 的（偏移 8）。
        expect(ranges[0].startOffset).toBe(27)
        expect(ranges[0].endOffset).toBe(29)
    })

    it('锚点列对不上（如角标文本导致列偏移）：取候选行内首个命中', () => {
        const target = makeTarget([{ text: 'denied\nprefix denied', parentSelectors: [] }])

        applyPreviewHighlight(contentEl, target, 'ni', { relativeLine: 2, column: 5 })

        const ranges = currentHighlights.get(HIGHLIGHT_NAME).ranges
        expect(ranges).toHaveLength(1)
        // 列 5 无精确命中，退到第 2 行（渲染行 1）的首个 "ni"：行起点 7 + 列 9。
        expect(ranges[0].startOffset).toBe(16)
    })

    it('锚点行超出渲染文本行数（段落等无换行块）：退回首个命中', () => {
        const target = makeTarget([{ text: 'warning warning', parentSelectors: [] }])

        applyPreviewHighlight(contentEl, target, 'warning', { relativeLine: 3, column: 0 })

        const ranges = currentHighlights.get(HIGHLIGHT_NAME).ranges
        expect(ranges).toHaveLength(1)
        expect(ranges[0].startOffset).toBe(0)
    })

    it('SVG 内外混合命中：只把 SVG 外的命中交给 Highlight API', () => {
        const target = makeTarget([
            { text: 'mermaid 说明', parentSelectors: [] },
            { text: 'mermaid 节点', parentSelectors: ['svg'] }
        ])

        applyPreviewHighlight(contentEl, target, 'mermaid')

        expect(currentHighlights.has(HIGHLIGHT_NAME)).toBe(true)
        // SVG 内那段收集阶段被排除，只剩 SVG 外的 "mermaid" 参与匹配与绘制。
        expect(currentHighlights.get(HIGHLIGHT_NAME).ranges).toHaveLength(1)
        expect(target.classList.contains(FALLBACK_CLASS)).toBe(false)
    })
})

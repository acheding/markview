import { findAllTextMatches } from '../core/search/match.js'

const HIGHLIGHT_NAME = 'markview-search'
const FALLBACK_CLASS = 'is-search-highlight'

const supportsCustomHighlight = () => Boolean(window.CSS?.highlights && window.Highlight)

// 判断文本节点是否参与搜索/高亮。排除两类：
// 1) 标题锚点 #（.heading-anchor）。
// 2) SVG 内的非 HTML 文本（<style> 的 CSS、<text>/<tspan> 等）：这些既画不了 Highlight，
//    也不是图里的可见文字；尤其 mermaid 会把含 "mermaid" 字样的 <style> 排在最前面，
//    混进匹配文本会让“第一个命中”错位到画不了的节点，导致整块只剩 outline。
//    mermaid 的标签是 <foreignObject> 内的 HTML（默认 htmlLabels=true），Highlight API 能画，需保留。
const isSearchableTextNode = (node) => {
    const el = node.parentElement
    if (!el || el.closest('.heading-anchor')) return false
    if (el.closest('svg') && !el.closest('foreignObject')) return false
    return true
}

// 块内多处同词命中时，按锚点（命中行相对块首的行偏移 relativeLine + 行内列偏移 column）
// 挑选与搜索结果对应的那一处。行映射只在渲染文本保留换行的块（代码块 / mermaid 源码）成立：
// 围栏行（```lang）不进入渲染文本，内容行整体上移一行，故候选行优先取 relativeLine - 1，
// 无围栏的块（缩进代码等）再退到 relativeLine。列能对上的最准（代码块文本与源码逐字符一致）；
// 对不上取候选行内首个命中（如首行前拼了语言角标文本导致列整体偏移）；
// 行也对不上（段落等无换行块）退回首个命中，即原有行为。
const pickAnchoredMatch = (matches, text, anchor) => {
    if (matches.length < 2) return matches[0] ?? null
    if (!Number.isFinite(anchor?.relativeLine) || anchor.relativeLine < 0) return matches[0]

    const lineStarts = [0]
    for (let index = 0; index < text.length; index += 1) {
        if (text[index] === '\n') lineStarts.push(index + 1)
    }

    const lineIndexOf = (offset) => {
        let line = 0
        while (line + 1 < lineStarts.length && lineStarts[line + 1] <= offset) line += 1
        return line
    }

    const located = matches.map((match) => {
        const line = lineIndexOf(match.from)
        return { match, line, column: match.from - lineStarts[line] }
    })
    const candidateLines = [anchor.relativeLine - 1, anchor.relativeLine].filter(
        (line) => line >= 0 && line < lineStarts.length
    )

    for (const line of candidateLines) {
        const exact = located.find((item) => item.line === line && item.column === anchor.column)
        if (exact) return exact.match
    }
    for (const line of candidateLines) {
        const onLine = located.find((item) => item.line === line)
        if (onLine) return onLine.match
    }

    return matches[0]
}

// 遍历目标块内可搜索的文本节点，拼成整段文本后用统一匹配算法定位命中，
// 再把命中区间映射回若干 DOM Range。
const createTextRanges = (target, query, anchor) => {
    const textNodes = []
    const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT)
    let text = ''
    let node = walker.nextNode()

    while (node) {
        if (isSearchableTextNode(node)) {
            textNodes.push({ node, start: text.length, end: text.length + node.data.length })
            text += node.data
        }
        node = walker.nextNode()
    }

    const match = pickAnchoredMatch(findAllTextMatches(text, query), text, anchor)
    if (!match) return []

    return textNodes
        .filter((item) => item.start < match.to && item.end > match.from)
        .map((item) => {
            const range = document.createRange()
            range.setStart(item.node, Math.max(0, match.from - item.start))
            range.setEnd(item.node, Math.min(item.node.data.length, match.to - item.start))
            return range
        })
}

export const clearPreviewHighlight = (contentEl) => {
    if (!contentEl) return

    window.CSS?.highlights?.delete(HIGHLIGHT_NAME)
    contentEl.querySelectorAll(`.${FALLBACK_CLASS}`).forEach((element) => {
        element.classList.remove(FALLBACK_CLASS)
    })
}

// 在指定块内高亮匹配文本。优先用 CSS Custom Highlight（不改 DOM），否则降级为 outline class。
// anchor（可选）：{ relativeLine, column }，用于块内多处同词命中时选中搜索结果对应的那处。
export const applyPreviewHighlight = (contentEl, target, query, anchor) => {
    clearPreviewHighlight(contentEl)
    if (!target) return false

    // createTextRanges 已在收集阶段排除画不了的节点，剩下的 Range 都可绘制。
    // 没有命中时（如纯 SVG <text> 图，或命中只落在被排除的节点）降级为整块 outline。
    const ranges = createTextRanges(target, query, anchor)

    if (ranges.length && supportsCustomHighlight()) {
        window.CSS.highlights.set(HIGHLIGHT_NAME, new window.Highlight(...ranges))
    } else {
        // 同一块内跳转时，上方 clear 与这里的 add 在同一帧内完成，脉冲动画不会重启；
        // 中间强制一次 reflow 让浏览器确认「类确实被移除过」。降级路径低频，代价可忽略。
        void target.offsetWidth
        target.classList.add(FALLBACK_CLASS)
    }

    return true
}

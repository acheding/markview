import { findTextMatch } from '../core/search/match.js'

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

// 遍历目标块内可搜索的文本节点，拼成整段文本后用统一匹配算法定位命中，
// 再把命中区间映射回若干 DOM Range。
const createTextRanges = (target, query) => {
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

    const match = findTextMatch(text, query)
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
export const applyPreviewHighlight = (contentEl, target, query) => {
    clearPreviewHighlight(contentEl)
    if (!target) return false

    // createTextRanges 已在收集阶段排除画不了的节点，剩下的 Range 都可绘制。
    // 没有命中时（如纯 SVG <text> 图，或命中只落在被排除的节点）降级为整块 outline。
    const ranges = createTextRanges(target, query)

    if (ranges.length && supportsCustomHighlight()) {
        window.CSS.highlights.set(HIGHLIGHT_NAME, new window.Highlight(...ranges))
    } else {
        target.classList.add(FALLBACK_CLASS)
    }

    return true
}

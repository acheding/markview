import { findTextMatch } from '../core/search/match.js'

const HIGHLIGHT_NAME = 'markview-search'
const FALLBACK_CLASS = 'is-search-highlight'

const supportsCustomHighlight = () => Boolean(window.CSS?.highlights && window.Highlight)

// 遍历目标块内的文本节点（跳过标题锚点 #），拼成整段文本后用统一匹配算法定位命中，
// 再把命中区间映射回若干 DOM Range。
const createTextRanges = (target, query) => {
    const textNodes = []
    const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT)
    let text = ''
    let node = walker.nextNode()

    while (node) {
        if (!node.parentElement?.closest('.heading-anchor')) {
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

    const ranges = createTextRanges(target, query)

    if (ranges.length && supportsCustomHighlight()) {
        window.CSS.highlights.set(HIGHLIGHT_NAME, new window.Highlight(...ranges))
    } else {
        target.classList.add(FALLBACK_CLASS)
    }

    return true
}

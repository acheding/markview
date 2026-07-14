import { ref } from 'vue'
import { waitForAnimationFrame } from '../composables/useTransitionSettled.js'

const ACTIVE_HEADING_OFFSET = 4
// hash 恢复重对齐的边界：帧数上限（约 3s 安全阀）与判定「版面稳定」的连续静止帧数。
const MAX_RESTORE_FRAMES = 180
const RESTORE_STABLE_FRAMES = 8

const getHashHeadingId = () => {
    const hash = window.location.hash.replace(/^#/, '')
    if (!hash) return ''
    try {
        return decodeURIComponent(hash)
    } catch {
        return hash
    }
}

const setHashHeadingId = (id) => {
    const nextHash = `#${encodeURIComponent(id)}`
    if (window.location.hash === nextHash) return
    history.pushState(null, '', `${window.location.pathname}${window.location.search}${nextHash}`)
}

const headingTop = (scrollEl, element) => element.getBoundingClientRect().top - scrollEl.getBoundingClientRect().top

const isScrolledToEnd = (scrollEl) => {
    const maxScrollTop = Math.max(0, scrollEl.scrollHeight - scrollEl.clientHeight)
    return maxScrollTop > ACTIVE_HEADING_OFFSET && maxScrollTop - scrollEl.scrollTop <= ACTIVE_HEADING_OFFSET
}

const isHeadingVisible = (scrollEl, element) => {
    const top = headingTop(scrollEl, element)
    return top >= 0 && top <= scrollEl.clientHeight
}

// 标题导航：跟踪当前激活标题、hash 直达/回流兜底、点击标题写 hash。
export const createHeadingNavigation = ({ toc, getPreviewController }) => {
    const activeHeadingId = ref('')
    // 导航目标：TOC/锚点点击后、平滑滚动落定前的目标标题。
    // 期间不直接把 active 设为目标（否则会先跳到目标、再被滚动回弹到原处），
    // 而是让 active 随滚动逐个标题「走」过去，目标以 pending（悬浮态）示意。
    const navTargetId = ref('')
    let hashScrollRunId = 0
    // 恢复中：hash 定位正在把 active 钉在目标上，期间不让几何重算把它挤到上一个标题。
    let restoring = false

    const scrollEl = () => getPreviewController()?.scrollDOM

    const clearHash = () => {
        if (!window.location.hash) return
        history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
    }

    const updateActiveHeading = (preferredId = navTargetId.value) => {
        // 恢复期间 active 由 scrollToHashHeading 钉在 hash 目标上，忽略滚动/回流触发的几何重算。
        if (restoring) return
        const preview = scrollEl()
        if (!preview || !toc.value.length) {
            activeHeadingId.value = ''
            return
        }

        const headings = toc.value
            .map((item) => ({ id: item.id, element: preview.querySelector(`#${CSS.escape(item.id)}`) }))
            .filter((item) => item.element)

        if (!headings.length) {
            activeHeadingId.value = ''
            return
        }

        if (isScrolledToEnd(preview)) {
            const preferred = preferredId ? headings.find((heading) => heading.id === preferredId) : null
            activeHeadingId.value =
                preferred && isHeadingVisible(preview, preferred.element)
                    ? preferred.id
                    : headings[headings.length - 1].id
            return
        }

        let current = headings[0]
        for (const heading of headings) {
            if (headingTop(preview, heading.element) <= ACTIVE_HEADING_OFFSET) current = heading
            else break
        }
        activeHeadingId.value = current.id
    }

    const scrollToHashHeading = async () => {
        const id = getHashHeadingId()
        if (!id) {
            updateActiveHeading()
            return
        }

        const runId = ++hashScrollRunId
        restoring = true

        // 长文里图片/Mermaid 等异步内容会在首次对齐后继续回流，抬高目标上方的高度，
        // 把锚点挤出顶部。这里逐帧持续重对齐、并把 active 钉在目标上，直到内容高度
        // 连续多帧不再变化（版面稳定）或到达帧数上限，避免刷新后定位/高亮退回上一个标题。
        let lastHeight = -1
        let stableFrames = 0
        for (let index = 0; index < MAX_RESTORE_FRAMES; index += 1) {
            await waitForAnimationFrame()
            if (runId !== hashScrollRunId) return
            const preview = scrollEl()
            if (!preview) continue

            if (getPreviewController()?.scrollToHeading(id, { behavior: 'auto' })) {
                activeHeadingId.value = id
            }

            // 高度连续多帧不变即认为异步回流结束；标题不存在（垃圾 hash）时高度本就稳定，同样会退出。
            const height = preview.scrollHeight
            stableFrames = height === lastHeight ? stableFrames + 1 : 0
            lastHeight = height
            if (stableFrames >= RESTORE_STABLE_FRAMES) break
        }

        if (runId === hashScrollRunId) restoring = false
    }

    // 发起一次导航（TOC/锚点点击）：记录目标 + 写 hash，但不立刻改 active。
    // active 交给随后的平滑滚动逐帧驱动，最终由 endNavigation 兜底落在目标上。
    const beginNavigation = (id) => {
        // 用户主动导航：取消可能仍在进行的 hash 恢复重对齐，避免与新目标抢滚动。
        hashScrollRunId += 1
        restoring = false
        navTargetId.value = id
        setHashHeadingId(id)
    }

    // 平滑滚动结束（scrollend/兜底）时调用：把 active 锁定到目标，清空导航态。
    const endNavigation = () => {
        if (navTargetId.value) activeHeadingId.value = navTargetId.value
        navTargetId.value = ''
    }

    const init = () => window.addEventListener('hashchange', scrollToHashHeading)
    const dispose = () => {
        window.removeEventListener('hashchange', scrollToHashHeading)
        hashScrollRunId += 1
        restoring = false
    }

    return {
        activeHeadingId,
        clearHash,
        updateActiveHeading,
        scrollToHashHeading,
        beginNavigation,
        endNavigation,
        init,
        dispose
    }
}

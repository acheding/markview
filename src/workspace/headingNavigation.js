import { ref } from 'vue'
import { waitForAnimationFrame } from '../composables/useTransitionSettled.js'

const ACTIVE_HEADING_OFFSET = 4

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

// 标题导航：跟踪当前激活标题、hash 直达/重试、点击标题写 hash。
export const createHeadingNavigation = ({ toc, getPreviewController }) => {
    const activeHeadingId = ref('')
    let hashScrollRunId = 0
    let hashRetryTimer = null

    const scrollEl = () => getPreviewController()?.scrollDOM

    const clearHash = () => {
        if (!window.location.hash) return
        history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
    }

    const updateActiveHeading = (preferredId = '') => {
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
        clearTimeout(hashRetryTimer)

        for (let index = 0; index < 6; index += 1) {
            await waitForAnimationFrame()
            if (runId !== hashScrollRunId) return
            if (getPreviewController()?.scrollToHeading(id, { behavior: 'auto' })) {
                activeHeadingId.value = id
            }
        }

        hashRetryTimer = setTimeout(() => {
            if (runId !== hashScrollRunId) return
            if (getPreviewController()?.scrollToHeading(id, { behavior: 'auto' })) {
                activeHeadingId.value = id
            }
        }, 250)
    }

    const selectHeading = (id) => {
        activeHeadingId.value = id
        setHashHeadingId(id)
    }

    const init = () => window.addEventListener('hashchange', scrollToHashHeading)
    const dispose = () => {
        window.removeEventListener('hashchange', scrollToHashHeading)
        clearTimeout(hashRetryTimer)
    }

    return {
        activeHeadingId,
        clearHash,
        updateActiveHeading,
        scrollToHashHeading,
        selectHeading,
        init,
        dispose
    }
}

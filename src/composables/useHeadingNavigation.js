import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

const ACTIVE_HEADING_OFFSET = 4

const waitForAnimationFrame = () =>
    new Promise((resolve) => {
        requestAnimationFrame(resolve)
    })

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

const getHeadingTopInPreview = (preview, element) =>
    element.getBoundingClientRect().top - preview.getBoundingClientRect().top

const isPreviewScrolledToEnd = (preview) => {
    const maxScrollTop = Math.max(0, preview.scrollHeight - preview.clientHeight)

    return maxScrollTop > ACTIVE_HEADING_OFFSET && maxScrollTop - preview.scrollTop <= ACTIVE_HEADING_OFFSET
}

const isHeadingVisibleInPreview = (preview, element) => {
    const top = getHeadingTopInPreview(preview, element)

    return top >= 0 && top <= preview.clientHeight
}

export const useHeadingNavigation = ({ toc, getPreviewElement, getPreviewComponent }) => {
    const activeHeadingId = ref('')
    let hashScrollRunId = 0
    let hashRetryTimer = null

    const clearHash = () => {
        if (!window.location.hash) return

        history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
    }

    const updateActiveHeading = (preferredId = '') => {
        const preview = getPreviewElement()
        if (!preview || !toc.value.length) {
            activeHeadingId.value = ''
            return
        }

        const headings = toc.value
            .map((item) => ({
                id: item.id,
                element: preview.querySelector(`#${CSS.escape(item.id)}`)
            }))
            .filter((item) => item.element)

        if (!headings.length) {
            activeHeadingId.value = ''
            return
        }

        if (isPreviewScrolledToEnd(preview)) {
            const preferredHeading = preferredId ? headings.find((heading) => heading.id === preferredId) : null

            activeHeadingId.value =
                preferredHeading && isHeadingVisibleInPreview(preview, preferredHeading.element)
                    ? preferredHeading.id
                    : headings[headings.length - 1].id
            return
        }

        let current = headings[0]

        for (const heading of headings) {
            if (getHeadingTopInPreview(preview, heading.element) <= ACTIVE_HEADING_OFFSET) {
                current = heading
            } else {
                break
            }
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

        await nextTick()

        for (let index = 0; index < 6; index += 1) {
            await waitForAnimationFrame()
            if (runId !== hashScrollRunId) return

            const scrolled = getPreviewComponent()?.scrollToHeading(id, { behavior: 'auto' })
            if (scrolled) {
                activeHeadingId.value = id
            }
        }

        hashRetryTimer = setTimeout(() => {
            if (runId !== hashScrollRunId) return

            const scrolled = getPreviewComponent()?.scrollToHeading(id, { behavior: 'auto' })
            if (scrolled) {
                activeHeadingId.value = id
            }
        }, 250)
    }

    const selectHeading = (id) => {
        activeHeadingId.value = id
        setHashHeadingId(id)
    }

    onMounted(() => {
        window.addEventListener('hashchange', scrollToHashHeading)
    })

    onBeforeUnmount(() => {
        window.removeEventListener('hashchange', scrollToHashHeading)
        clearTimeout(hashRetryTimer)
    })

    return {
        activeHeadingId,
        clearHash,
        scrollToHashHeading,
        selectHeading,
        updateActiveHeading
    }
}

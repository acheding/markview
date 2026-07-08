import { nextTick, onBeforeUnmount, onMounted } from 'vue'

const SOURCE_RELEASE_DELAY = 180
const PROGRAMMATIC_RELEASE_DELAY = 120
const SCROLL_EPSILON = 1
const USER_SCROLL_EVENTS = ['wheel', 'pointerdown', 'touchstart', 'keydown']
const SOURCE_LINE_SELECTOR = '[data-source-line]'

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

const getLineHeight = (element) => {
    const styles = getComputedStyle(element)
    const lineHeight = Number.parseFloat(styles.lineHeight)

    if (Number.isFinite(lineHeight)) return lineHeight

    const fontSize = Number.parseFloat(styles.fontSize)
    return Number.isFinite(fontSize) ? fontSize * 1.7 : 24
}

const getEditorTopLine = (editor) => Math.max(1, Math.floor(editor.scrollTop / getLineHeight(editor)) + 1)

const setEditorTopLine = (editor, line) => {
    const nextScrollTop = Math.max(0, (line - 1) * getLineHeight(editor))

    if (Math.abs(editor.scrollTop - nextScrollTop) <= SCROLL_EPSILON) return false

    editor.scrollTo({
        top: nextScrollTop,
        behavior: 'auto',
    })

    return true
}

const getPreviewBlocks = (preview) => Array.from(preview.querySelectorAll(SOURCE_LINE_SELECTOR))
    .map((element) => ({
        element,
        line: Number(element.dataset.sourceLine),
    }))
    .filter((item) => Number.isFinite(item.line))

const getElementTop = (container, element) => {
    const containerRect = container.getBoundingClientRect()
    const elementRect = element.getBoundingClientRect()

    return container.scrollTop + elementRect.top - containerRect.top
}

const findBlockRangeByLine = (blocks, line) => {
    if (!blocks.length) return null

    let currentIndex = 0

    for (let index = 0; index < blocks.length; index += 1) {
        if (blocks[index].line <= line) {
            currentIndex = index
        } else {
            break
        }
    }

    return {
        current: blocks[currentIndex],
        next: blocks[currentIndex + 1] || null,
    }
}

const getPreviewTopByLine = (preview, line) => {
    const range = findBlockRangeByLine(getPreviewBlocks(preview), line)
    if (!range) return 0

    const currentTop = getElementTop(preview, range.current.element)

    if (!range.next || range.next.line <= range.current.line) {
        return currentTop
    }

    const nextTop = getElementTop(preview, range.next.element)
    const progress = clamp((line - range.current.line) / (range.next.line - range.current.line), 0, 1)

    return currentTop + ((nextTop - currentTop) * progress)
}

const setPreviewTopByLine = (preview, line) => {
    const top = getPreviewTopByLine(preview, line)

    if (Math.abs(preview.scrollTop - top) <= SCROLL_EPSILON) return false

    preview.scrollTo({
        top,
        behavior: 'auto',
    })

    return true
}

const getPreviewTopLine = (preview) => {
    const blocks = getPreviewBlocks(preview)
    if (!blocks.length) return 1

    let current = {
        ...blocks[0],
        top: getElementTop(preview, blocks[0].element),
    }
    let next = null
    const viewportTop = preview.scrollTop + 4

    for (let index = 0; index < blocks.length; index += 1) {
        const blockTop = getElementTop(preview, blocks[index].element)

        if (blockTop <= viewportTop) {
            current = {
                ...blocks[index],
                top: blockTop,
            }
            next = blocks[index + 1] || null
        } else {
            next = blocks[index]
            break
        }
    }

    if (!next || next.line <= current.line) return current.line

    const nextTop = getElementTop(preview, next.element)
    if (nextTop <= current.top) return current.line

    const progress = clamp((viewportTop - current.top) / (nextTop - current.top), 0, 1)

    return Math.round(current.line + ((next.line - current.line) * progress))
}

export const useScrollSync = ({ getEditorElement, getPreviewElement, onPreviewScroll }) => {
    let activeSource = ''
    let sourceReleaseTimer = null
    const programmaticScroll = {
        editor: false,
        preview: false,
    }
    const programmaticReleaseTimers = {
        editor: null,
        preview: null,
    }
    const cleanupListeners = []

    const clearSourceRelease = () => {
        clearTimeout(sourceReleaseTimer)
        sourceReleaseTimer = null
    }

    const releaseSourceSoon = () => {
        clearSourceRelease()
        sourceReleaseTimer = setTimeout(() => {
            activeSource = ''
        }, SOURCE_RELEASE_DELAY)
    }

    const markUserSource = (source) => {
        activeSource = source
        clearSourceRelease()
    }

    const releaseProgrammaticSoon = (target) => {
        clearTimeout(programmaticReleaseTimers[target])
        programmaticReleaseTimers[target] = setTimeout(() => {
            programmaticScroll[target] = false
        }, PROGRAMMATIC_RELEASE_DELAY)
    }

    const sync = (targetName, syncTarget) => {
        const editor = getEditorElement()
        const preview = getPreviewElement()
        if (!editor || !preview) return false

        programmaticScroll[targetName] = true
        const changed = syncTarget(editor, preview)

        if (changed) {
            releaseProgrammaticSoon(targetName)
        } else {
            programmaticScroll[targetName] = false
        }

        return changed
    }

    const handleEditorScroll = () => {
        if (programmaticScroll.editor || (activeSource && activeSource !== 'editor')) return

        activeSource = 'editor'
        sync('preview', (editor, preview) => setPreviewTopByLine(preview, getEditorTopLine(editor)))
        onPreviewScroll?.()
        releaseSourceSoon()
    }

    const handlePreviewScroll = () => {
        onPreviewScroll?.()

        if (programmaticScroll.preview || (activeSource && activeSource !== 'preview')) return

        activeSource = 'preview'
        sync('editor', (editor, preview) => setEditorTopLine(editor, getPreviewTopLine(preview)))
        releaseSourceSoon()
    }

    const addUserSourceListeners = (element, source) => {
        if (!element) return

        const listener = () => markUserSource(source)
        USER_SCROLL_EVENTS.forEach((eventName) => {
            element.addEventListener(eventName, listener, { passive: true })
            cleanupListeners.push(() => element.removeEventListener(eventName, listener))
        })
    }

    onMounted(async () => {
        await nextTick()
        addUserSourceListeners(getEditorElement(), 'editor')
        addUserSourceListeners(getPreviewElement(), 'preview')
    })

    onBeforeUnmount(() => {
        cleanupListeners.forEach((cleanup) => cleanup())
        cleanupListeners.length = 0
        clearSourceRelease()
        Object.values(programmaticReleaseTimers).forEach((timer) => clearTimeout(timer))
    })

    return {
        handleEditorScroll,
        handlePreviewScroll,
    }
}

import { nextTick, onBeforeUnmount, onMounted } from 'vue'
import { clamp } from '../utils/text'

const SOURCE_RELEASE_DELAY = 180
const PROGRAMMATIC_RELEASE_DELAY = 120
const SCROLL_EPSILON = 1
const USER_SCROLL_EVENTS = ['wheel', 'pointerdown', 'touchstart', 'keydown']
const SOURCE_LINE_SELECTOR = '[data-source-line]'

const getElementTop = (container, element) => {
    const containerRect = container.getBoundingClientRect()
    const elementRect = element.getBoundingClientRect()

    return container.scrollTop + elementRect.top - containerRect.top
}

const getPreviewBlocks = (preview) =>
    Array.from(preview.querySelectorAll(SOURCE_LINE_SELECTOR))
        .map((element) => ({
            element,
            line: Number(element.dataset.sourceLine)
        }))
        .filter((item) => Number.isFinite(item.line))

// 构建锚点表：对每个共享的源行，记录一对对齐的滚动偏移（编辑区、预览区）。
// 两端各加一个哨兵锚点，把文档顶部与底部钉在一起，使两侧能同时到达 0 和最大值。
const buildAnchors = (editor, preview, getEditorLineTop) => {
    const editorMax = Math.max(0, editor.scrollHeight - editor.clientHeight)
    const previewMax = Math.max(0, preview.scrollHeight - preview.clientHeight)

    const blocks = getPreviewBlocks(preview)

    const raw = blocks
        .map((block) => ({
            editor: getEditorLineTop(block.line),
            preview: getElementTop(preview, block.element)
        }))
        .filter((anchor) => Number.isFinite(anchor.editor) && Number.isFinite(anchor.preview))
        .sort((a, b) => a.editor - b.editor)

    // 只保留严格落在两侧滚动范围内、且在两个轴上都严格递增的锚点，
    // 以保证每一段插值都是单调的。
    const anchors = [{ editor: 0, preview: 0 }]
    let lastEditor = 0
    let lastPreview = 0

    raw.forEach((anchor) => {
        if (anchor.editor <= lastEditor || anchor.preview <= lastPreview) return
        if (anchor.editor >= editorMax || anchor.preview >= previewMax) return

        anchors.push(anchor)
        lastEditor = anchor.editor
        lastPreview = anchor.preview
    })

    anchors.push({ editor: editorMax, preview: previewMax })

    return anchors
}

const interpolate = (anchors, fromKey, toKey, value) => {
    if (!anchors.length) return 0

    const first = anchors[0]
    const last = anchors[anchors.length - 1]
    if (value <= first[fromKey]) return first[toKey]
    if (value >= last[fromKey]) return last[toKey]

    for (let index = 1; index < anchors.length; index += 1) {
        const upper = anchors[index]
        if (value <= upper[fromKey]) {
            const lower = anchors[index - 1]
            const span = upper[fromKey] - lower[fromKey]
            if (span <= 0) return lower[toKey]

            const progress = clamp((value - lower[fromKey]) / span, 0, 1)
            return lower[toKey] + (upper[toKey] - lower[toKey]) * progress
        }
    }

    return last[toKey]
}

const applyScroll = (element, top) => {
    if (Math.abs(element.scrollTop - top) <= SCROLL_EPSILON) return false

    element.scrollTo({
        top,
        behavior: 'auto'
    })

    return true
}

export const useScrollSync = ({
    getEditorDocumentLength,
    getEditorElement,
    getEditorLineTop,
    getPreviewElement,
    isSyncEnabled = () => true,
    onPreviewScroll
}) => {
    let activeSource = ''
    let sourceReleaseTimer = null
    const programmaticScroll = {
        editor: false,
        preview: false
    }
    const programmaticReleaseTimers = {
        editor: null,
        preview: null
    }
    const cleanupListeners = []
    const anchorCache = {
        signature: '',
        anchors: null
    }

    const getAnchors = (editor, preview) => {
        const signature = [
            getEditorDocumentLength(),
            editor.scrollHeight,
            editor.clientWidth,
            editor.clientHeight,
            preview.scrollHeight,
            preview.clientWidth,
            preview.clientHeight
        ].join('|')

        if (anchorCache.signature !== signature || !anchorCache.anchors) {
            anchorCache.signature = signature
            anchorCache.anchors = buildAnchors(editor, preview, getEditorLineTop)
        }

        return anchorCache.anchors
    }

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
        if (!isSyncEnabled()) return

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
        if (!isSyncEnabled()) return
        if (programmaticScroll.editor || (activeSource && activeSource !== 'editor')) return

        activeSource = 'editor'
        sync('preview', (editor, preview) => {
            const anchors = getAnchors(editor, preview)
            return applyScroll(preview, interpolate(anchors, 'editor', 'preview', editor.scrollTop))
        })
        onPreviewScroll?.()
        releaseSourceSoon()
    }

    const handlePreviewScroll = () => {
        onPreviewScroll?.()

        if (!isSyncEnabled()) return
        if (programmaticScroll.preview || (activeSource && activeSource !== 'preview')) return

        activeSource = 'preview'
        sync('editor', (editor, preview) => {
            const anchors = getAnchors(editor, preview)
            return applyScroll(editor, interpolate(anchors, 'preview', 'editor', preview.scrollTop))
        })
        releaseSourceSoon()
    }

    // 把编辑区与预览区一次性对齐到指定源行（用于搜索定位）。
    // 编辑区按固定视口比例定位，预览区用锚点映射跟随，两侧都以程序滚动瞬时完成，
    // 避免与联动同步竞争，保证同一行每次定位到相同位置。
    const alignToSourceLine = (line, { viewportRatio = 0.3 } = {}) => {
        if (!isSyncEnabled()) return

        const editor = getEditorElement()
        const preview = getPreviewElement()
        if (!editor || !preview) return

        const targetLine = Math.max(1, Number(line) || 1)
        const editorLineTop = getEditorLineTop(targetLine)
        if (!Number.isFinite(editorLineTop)) return

        // 锁定：清除激活来源、两侧标记程序滚动，屏蔽本次滚动触发的联动回环。
        clearSourceRelease()
        activeSource = ''
        programmaticScroll.editor = true
        programmaticScroll.preview = true

        const editorTarget = Math.max(0, editorLineTop - editor.clientHeight * viewportRatio)
        editor.scrollTo({ top: editorTarget, behavior: 'auto' })

        const anchors = getAnchors(editor, preview)
        const previewTarget = interpolate(anchors, 'editor', 'preview', editorTarget)
        preview.scrollTo({ top: previewTarget, behavior: 'auto' })

        releaseProgrammaticSoon('editor')
        releaseProgrammaticSoon('preview')
        onPreviewScroll?.()
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
        alignToSourceLine
    }
}

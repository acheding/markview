import { clamp } from '../text.js'

/**
 * 构建锚点表：pairs 是若干对已对齐的滚动偏移 { editor, preview }。
 * 两端各加一个哨兵锚点，把文档顶部与底部钉在一起，使两侧能同时到达 0 和最大值。
 * 只保留严格落在两侧滚动范围内、且在两个轴上都严格递增的锚点，
 * 以保证每一段插值都是单调的。
 */
export const buildAnchorTable = ({ pairs, editorMax, previewMax }) => {
    const raw = pairs
        .filter((anchor) => Number.isFinite(anchor.editor) && Number.isFinite(anchor.preview))
        .sort((a, b) => a.editor - b.editor)

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

// 在锚点表上做分段线性插值：把 fromKey 轴上的偏移映射到 toKey 轴。
export const interpolate = (anchors, fromKey, toKey, value) => {
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

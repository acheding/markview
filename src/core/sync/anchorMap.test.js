import { describe, expect, it } from 'vitest'
import { buildAnchorTable, interpolate } from './anchorMap.js'

describe('buildAnchorTable', () => {
    it('pins sentinels at both ends and keeps only strictly increasing anchors', () => {
        const anchors = buildAnchorTable({
            pairs: [
                { editor: 100, preview: 80 },
                { editor: 90, preview: 200 }, // preview 越界，丢弃
                { editor: 300, preview: 260 }, // editor 越界，丢弃
                { editor: 100, preview: 90 } // editor 不递增，丢弃
            ],
            editorMax: 200,
            previewMax: 160
        })

        expect(anchors[0]).toEqual({ editor: 0, preview: 0 })
        expect(anchors.at(-1)).toEqual({ editor: 200, preview: 160 })
        expect(anchors).toContainEqual({ editor: 100, preview: 80 })
        expect(anchors).toHaveLength(3)
    })
})

describe('interpolate', () => {
    const anchors = [
        { editor: 0, preview: 0 },
        { editor: 100, preview: 50 },
        { editor: 200, preview: 250 }
    ]

    it('clamps outside the range and interpolates linearly inside', () => {
        expect(interpolate(anchors, 'editor', 'preview', -10)).toBe(0)
        expect(interpolate(anchors, 'editor', 'preview', 250)).toBe(250)
        expect(interpolate(anchors, 'editor', 'preview', 50)).toBe(25)
        expect(interpolate(anchors, 'editor', 'preview', 150)).toBe(150)
    })

    it('maps back in the reverse direction', () => {
        expect(interpolate(anchors, 'preview', 'editor', 50)).toBe(100)
    })
})

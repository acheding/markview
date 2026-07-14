import { describe, expect, it } from 'vitest'
import { clamp, countImages, countWords, escapeHtml, stripHtml, stripImageData } from './text.js'

describe('text utilities', () => {
    it('clamps a value into range', () => {
        expect(clamp(5, 0, 10)).toBe(5)
        expect(clamp(-1, 0, 10)).toBe(0)
        expect(clamp(20, 0, 10)).toBe(10)
    })

    it('escapes html-sensitive characters', () => {
        expect(escapeHtml('<a title="x">Tom & Jerry</a>')).toBe(
            '&lt;a title=&quot;x&quot;&gt;Tom &amp; Jerry&lt;/a&gt;'
        )
    })

    it('strips simple html and counts mixed Chinese and English words', () => {
        expect(stripHtml('<strong>MarkView</strong> 文档')).toBe('MarkView 文档')
        expect(countWords("MarkView 支持 Markdown previewer's flow")).toBe(6)
    })

    it('strips inline image base64 data so stats ignore it', () => {
        const base64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ'
        const md = `前文 ![图](data:image/png;base64,${base64}) 后文`
        const stripped = stripImageData(md)
        // 整个 data URL（含前缀）都被剔除，只留 Markdown 图片语法骨架
        expect(stripped).toBe('前文 ![图]() 后文')
        expect(stripped).not.toContain(base64)
    })

    it('counts markdown images (inline base64 and linked)', () => {
        const md = [
            '![a](data:image/png;base64,iVBORw0KGgo=)',
            '正文 ![b](https://example.com/x.png) 更多',
            '这里没有图片，只有 [链接](https://example.com)'
        ].join('\n')
        expect(countImages(md)).toBe(2)
        expect(countImages('纯文本无图')).toBe(0)
    })
})

import { describe, expect, it } from 'vitest'
import { clamp, countWords, escapeHtml, stripHtml } from './text.js'

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
})

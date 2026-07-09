import { describe, expect, it } from 'vitest'
import { countWords, createSlugger, escapeHtml, stripHtml } from './text.js'

describe('text utilities', () => {
    it('escapes html-sensitive characters', () => {
        expect(escapeHtml('<a title="x">Tom & Jerry</a>')).toBe(
            '&lt;a title=&quot;x&quot;&gt;Tom &amp; Jerry&lt;/a&gt;'
        )
    })

    it('creates stable unique heading slugs', () => {
        const slug = createSlugger()

        expect(slug('安装 & 使用')).toBe('安装-使用')
        expect(slug('安装 & 使用')).toBe('安装-使用-1')
        expect(slug('***')).toBe('heading')
    })

    it('strips simple html and counts mixed Chinese and English words', () => {
        expect(stripHtml('<strong>MarkView</strong> 文档')).toBe('MarkView 文档')
        expect(countWords("MarkView 支持 Markdown previewer's flow")).toBe(6)
    })
})

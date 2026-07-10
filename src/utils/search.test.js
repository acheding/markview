import { describe, expect, it } from 'vitest'
import { findTextMatch } from './search.js'

describe('findTextMatch', () => {
    it('finds a case-insensitive match and returns its range', () => {
        expect(findTextMatch('Hello Markdown', 'markdown')).toEqual({ from: 6, to: 14 })
    })

    it('trims the query before matching', () => {
        expect(findTextMatch('搜索高亮', ' 高亮 ')).toEqual({ from: 2, to: 4 })
    })

    it('returns null for empty or missing matches', () => {
        expect(findTextMatch('content', '')).toBeNull()
        expect(findTextMatch('content', 'missing')).toBeNull()
    })
})

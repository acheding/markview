import { describe, expect, it } from 'vitest'
import { findAllTextMatches, findTextMatch, normalizeQuery } from './match.js'

describe('normalizeQuery', () => {
    it('trims and lowercases the query', () => {
        expect(normalizeQuery('  Test ')).toBe('test')
        expect(normalizeQuery(null)).toBe('')
    })
})

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

describe('findAllTextMatches', () => {
    it('returns every non-overlapping match from left to right', () => {
        expect(findAllTextMatches('denied warNIng', 'ni')).toEqual([
            { from: 2, to: 4 },
            { from: 10, to: 12 }
        ])
    })

    it('advances past each match to avoid overlaps', () => {
        expect(findAllTextMatches('aaaa', 'aa')).toEqual([
            { from: 0, to: 2 },
            { from: 2, to: 4 }
        ])
    })

    it('returns an empty array for empty or missing matches', () => {
        expect(findAllTextMatches('content', '')).toEqual([])
        expect(findAllTextMatches('content', 'missing')).toEqual([])
    })
})

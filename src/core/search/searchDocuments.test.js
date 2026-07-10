import { describe, expect, it } from 'vitest'
import { searchDocuments } from './searchDocuments.js'

const files = [
    { id: 'a', name: 'alpha.md', content: 'first line\nmark here\nno match', updatedAt: 1 },
    { id: 'b', name: 'mark-notes.md', content: 'another mark line', updatedAt: 2 }
]

describe('searchDocuments', () => {
    it('returns an empty list for a blank query', () => {
        expect(searchDocuments(files, '  ')).toEqual([])
    })

    it('matches file names and content lines with a unified model', () => {
        const results = searchDocuments(files, 'mark')

        const nameResult = results.find((item) => item.kind === 'name')
        expect(nameResult).toMatchObject({ fileId: 'b', kind: 'name', lineNumber: null, match: null, query: 'mark' })

        const lineResult = results.find((item) => item.kind === 'line' && item.fileId === 'a')
        expect(lineResult).toMatchObject({ fileId: 'a', kind: 'line', lineNumber: 2, match: { from: 0, to: 4 } })
    })

    it('prioritizes results from the active file', () => {
        const results = searchDocuments(files, 'mark', { activeFileId: 'a' })
        expect(results[0].fileId).toBe('a')
    })

    it('respects the result limit', () => {
        const results = searchDocuments(files, 'mark', { limit: 1 })
        expect(results).toHaveLength(1)
    })
})

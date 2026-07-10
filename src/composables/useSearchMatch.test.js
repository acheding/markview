import { describe, expect, it } from 'vitest'
import { useSearchMatch } from './useSearchMatch.js'

describe('useSearchMatch', () => {
    it('normalizes and stores a valid search match', () => {
        const { activeSearchMatch, setSearchMatch } = useSearchMatch()

        setSearchMatch({
            fileId: 'doc-1',
            lineNumber: 3,
            matchStart: 4,
            matchEnd: 8,
            query: ' Test '
        })

        expect(activeSearchMatch.value).toEqual({
            fileId: 'doc-1',
            lineNumber: 3,
            matchStart: 4,
            matchEnd: 8,
            query: 'test'
        })
    })

    it('keeps the match for the same query and clears it for a different query', () => {
        const { activeSearchMatch, handleSearchQueryChange, setSearchMatch } = useSearchMatch()
        setSearchMatch({ fileId: 'doc-1', lineNumber: 1, query: 'mark' })

        handleSearchQueryChange(' MARK ')
        expect(activeSearchMatch.value).not.toBeNull()

        handleSearchQueryChange('view')
        expect(activeSearchMatch.value).toBeNull()
    })
})

import { describe, expect, it } from 'vitest'
import { buildSnippet, splitMatchParts } from './snippet.js'

describe('buildSnippet', () => {
    it('labels empty lines and collapses whitespace', () => {
        expect(buildSnippet('   ', 'x')).toBe('空行')
        expect(buildSnippet('a\t\tb', '')).toBe('a b')
    })

    it('centers the excerpt around the match with ellipses', () => {
        const long = `${'前'.repeat(60)}目标${'后'.repeat(120)}`
        const snippet = buildSnippet(long, '目标')

        expect(snippet).toContain('目标')
        expect(snippet.startsWith('...')).toBe(true)
        expect(snippet.endsWith('...')).toBe(true)
    })
})

describe('splitMatchParts', () => {
    it('splits text into matched and unmatched parts', () => {
        expect(splitMatchParts('Hello world hello', 'hello')).toEqual([
            { text: 'Hello', match: true },
            { text: ' world ', match: false },
            { text: 'hello', match: true }
        ])
    })

    it('returns the whole text unmatched for an empty query', () => {
        expect(splitMatchParts('text', '')).toEqual([{ text: 'text', match: false }])
    })
})

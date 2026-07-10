import { CompletionContext } from '@codemirror/autocomplete'
import { EditorState } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import { createMarkdownCompletionSource } from './markdownCompletion.js'

const complete = (text, options = {}) => {
    const source = createMarkdownCompletionSource(options)
    const state = EditorState.create({ doc: text })
    return source(new CompletionContext(state, text.length, false))
}

describe('createMarkdownCompletionSource', () => {
    it('completes anchors from the current document', () => {
        const result = complete('[跳转](#kuai', {
            getHeadings: () => [
                { id: '快速开始', title: '快速开始', level: 2 },
                { id: '快速开始-1', title: '快速开始', level: 3 }
            ]
        })

        expect(result.from).toBe('[跳转]('.length)
        expect(result.options.map((option) => option.label)).toEqual(['#快速开始', '#快速开始-1'])
        expect(result.validFor.test('#快速')).toBe(true)
    })

    it('completes workspace document names and URI-encodes spaces', () => {
        const result = complete('[文档](./Gu', {
            getDocuments: () => [
                { id: '1', name: 'Guide Start.md' },
                { id: '2', name: 'README.md' }
            ]
        })

        expect(result.from).toBe('[文档]('.length)
        expect(result.options).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ displayLabel: 'Guide Start.md', apply: './Guide%20Start.md' }),
                expect.objectContaining({ displayLabel: 'README.md', apply: './README.md' })
            ])
        )
    })

    it('does not activate outside a Markdown link destination', () => {
        expect(
            complete('普通正文 #kuai', { getHeadings: () => [{ id: '快速开始', title: '快速开始', level: 2 }] })
        ).toBeNull()
    })
})

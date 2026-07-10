import { LanguageDescription, LanguageSupport } from '@codemirror/language'
import { describe, expect, it } from 'vitest'
import { markdownCodeLanguages } from './codeLanguages.js'

const aliases = ['js', 'jsx', 'ts', 'tsx', 'css', 'html', 'vue', 'xml', 'json', 'py', 'bash', 'md']

describe('markdownCodeLanguages', () => {
    it.each(aliases)('resolves and loads the %s fenced-code language', async (alias) => {
        const description = LanguageDescription.matchLanguageName(markdownCodeLanguages, alias, false)

        expect(description).not.toBeNull()
        await expect(description.load()).resolves.toBeInstanceOf(LanguageSupport)
    })

    it('does not guess an unsupported language', () => {
        expect(LanguageDescription.matchLanguageName(markdownCodeLanguages, 'unknown-language', false)).toBeNull()
    })
})

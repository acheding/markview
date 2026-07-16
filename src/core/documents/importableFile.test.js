import { describe, expect, it } from 'vitest'
import { dragHasNonImageFile, isImageFile, isImportableTextFile } from './importableFile.js'

describe('isImportableTextFile', () => {
    it('accepts markdown / text extensions regardless of MIME', () => {
        expect(isImportableTextFile({ name: 'note.md', type: '' })).toBe(true)
        expect(isImportableTextFile({ name: 'a.markdown', type: '' })).toBe(true)
        expect(isImportableTextFile({ name: 'README.MKD', type: '' })).toBe(true)
        expect(isImportableTextFile({ name: 'log.txt', type: '' })).toBe(true)
    })

    it('accepts any text/* MIME even without a known extension', () => {
        expect(isImportableTextFile({ name: 'data', type: 'text/plain' })).toBe(true)
        expect(isImportableTextFile({ name: 'x.csv', type: 'text/csv' })).toBe(true)
    })

    it('rejects images even when the extension looks textual', () => {
        expect(isImportableTextFile({ name: 'shot.md', type: 'image/png' })).toBe(false)
        expect(isImportableTextFile({ name: 'photo.png', type: 'image/png' })).toBe(false)
    })

    it('rejects other binary formats', () => {
        expect(isImportableTextFile({ name: 'doc.pdf', type: 'application/pdf' })).toBe(false)
        expect(isImportableTextFile({ name: 'pack.zip', type: 'application/zip' })).toBe(false)
        expect(isImportableTextFile()).toBe(false)
    })
})

describe('isImageFile', () => {
    it('matches only image MIME types', () => {
        expect(isImageFile({ type: 'image/jpeg' })).toBe(true)
        expect(isImageFile({ type: 'text/plain' })).toBe(false)
        expect(isImageFile()).toBe(false)
    })
})

describe('dragHasNonImageFile', () => {
    it('shows the overlay for text and any non-image files', () => {
        expect(dragHasNonImageFile([''])).toBe(true)
        expect(dragHasNonImageFile(['text/plain'])).toBe(true)
        expect(dragHasNonImageFile(['text/markdown'])).toBe(true)
        expect(dragHasNonImageFile(['application/pdf'])).toBe(true)
        expect(dragHasNonImageFile(['application/zip'])).toBe(true)
    })

    it('does not show the overlay for images only', () => {
        expect(dragHasNonImageFile(['image/png'])).toBe(false)
        expect(dragHasNonImageFile(['image/png', 'image/jpeg'])).toBe(false)
    })

    it('shows the overlay when a non-image is mixed with images', () => {
        expect(dragHasNonImageFile(['image/png', ''])).toBe(true)
        expect(dragHasNonImageFile(['image/png', 'application/pdf'])).toBe(true)
    })

    it('handles no file items', () => {
        expect(dragHasNonImageFile([])).toBe(false)
        expect(dragHasNonImageFile()).toBe(false)
    })
})

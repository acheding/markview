import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { printDocument } from './exporter.js'

const createBrowserGlobals = ({ title = 'notes.md', theme } = {}) => {
    const windowMock = new EventTarget()
    windowMock.print = vi.fn()

    const documentMock = {
        documentElement: { dataset: {} },
        title
    }
    if (theme) documentMock.documentElement.dataset.theme = theme

    vi.stubGlobal('window', windowMock)
    vi.stubGlobal('document', documentMock)
    return { documentMock, windowMock }
}

beforeEach(() => {
    vi.useFakeTimers()
})

afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
})

describe('printDocument', () => {
    it('uses the document name without its Markdown extension while printing', () => {
        const { documentMock, windowMock } = createBrowserGlobals({ theme: 'dark' })
        windowMock.print.mockImplementation(() => {
            expect(documentMock.title).toBe('notes')
            expect(documentMock.documentElement.dataset.theme).toBe('light')
        })

        printDocument('notes.md')
        windowMock.dispatchEvent(new Event('afterprint'))

        expect(documentMock.title).toBe('notes.md')
        expect(documentMock.documentElement.dataset.theme).toBe('dark')
    })

    it('restores the title and an unset theme through the timeout fallback', () => {
        const { documentMock } = createBrowserGlobals({ title: 'original title' })

        printDocument('a/b.markdown')
        expect(documentMock.title).toBe('a-b')

        vi.advanceTimersByTime(1500)
        expect(documentMock.title).toBe('original title')
        expect(documentMock.documentElement.dataset.theme).toBeUndefined()
    })
})

import { describe, expect, it, vi } from 'vitest'
import { createPreviewRenderSession } from './previewRenderSession.js'

const deferred = () => {
    let resolve
    const promise = new Promise((settle) => {
        resolve = settle
    })
    return { promise, resolve }
}

const createRendererHarness = () => {
    let sequence = 0
    let handleResult = null
    const renderer = {
        render: vi.fn(() => (sequence += 1)),
        whenApplied: vi.fn().mockResolvedValue(true),
        dispose: vi.fn()
    }
    return {
        renderer,
        createRenderer: (handler) => {
            handleResult = handler
            return renderer
        },
        emit: (resultSequence, html) => handleResult({ html, toc: [] }, resultSequence)
    }
}

describe('createPreviewRenderSession', () => {
    it('publishes only after the complete preview HTML has been prepared', async () => {
        const harness = createRendererHarness()
        const prepared = deferred()
        const onResult = vi.fn()
        const session = createPreviewRenderSession({
            onResult,
            getTheme: () => 'light',
            prepareHtml: vi.fn(() => prepared.promise),
            createRenderer: harness.createRenderer
        })

        const sequence = session.render('source')
        const published = session.whenPublished(sequence)
        harness.emit(sequence, '<div class="mermaid-block">source</div>')
        await Promise.resolve()
        expect(onResult).not.toHaveBeenCalled()

        prepared.resolve('<div class="mermaid-block"><svg /></div>')
        await expect(published).resolves.toBe(true)
        expect(onResult).toHaveBeenCalledWith({
            html: '<div class="mermaid-block"><svg /></div>',
            toc: []
        })
    })

    it('drops a prepared result when a newer source has been requested', async () => {
        const harness = createRendererHarness()
        const firstPrepared = deferred()
        const secondPrepared = deferred()
        const prepareHtml = vi
            .fn()
            .mockImplementationOnce(() => firstPrepared.promise)
            .mockImplementationOnce(() => secondPrepared.promise)
        const onResult = vi.fn()
        const session = createPreviewRenderSession({
            onResult,
            getTheme: () => 'light',
            prepareHtml,
            createRenderer: harness.createRenderer
        })

        const first = session.render('first')
        harness.emit(first, '<p>first</p>')
        const second = session.render('second')
        const published = session.whenPublished(second)
        harness.emit(second, '<p>second</p>')

        firstPrepared.resolve('<p>prepared first</p>')
        secondPrepared.resolve('<p>prepared second</p>')

        await expect(published).resolves.toBe(true)
        expect(onResult).toHaveBeenCalledTimes(1)
        expect(onResult).toHaveBeenCalledWith({ html: '<p>prepared second</p>', toc: [] })
    })

    it('does not report publication before the atomic commit has finished', async () => {
        const harness = createRendererHarness()
        const committed = deferred()
        const session = createPreviewRenderSession({
            onResult: () => committed.promise,
            getTheme: () => 'light',
            prepareHtml: (html) => Promise.resolve(html),
            createRenderer: harness.createRenderer
        })

        const sequence = session.render('source')
        const published = session.whenPublished(sequence)
        const resolved = vi.fn()
        published.then(resolved)
        harness.emit(sequence, '<p>complete</p>')
        await Promise.resolve()
        await Promise.resolve()
        expect(resolved).not.toHaveBeenCalled()

        committed.resolve()
        await expect(published).resolves.toBe(true)
    })

    it('rebuilds the latest raw result when the theme changes', async () => {
        const harness = createRendererHarness()
        let theme = 'light'
        const prepareHtml = vi.fn((html) => Promise.resolve(`${html}:${theme}`))
        const onResult = vi.fn()
        const session = createPreviewRenderSession({
            onResult,
            getTheme: () => theme,
            prepareHtml,
            createRenderer: harness.createRenderer
        })

        const sequence = session.render('source')
        harness.emit(sequence, '<p>raw</p>')
        await session.whenPublished(sequence)

        theme = 'dark'
        await expect(session.refresh()).resolves.toBe(true)
        expect(onResult).toHaveBeenLastCalledWith({ html: '<p>raw</p>:dark', toc: [] })
    })

    it('reports preparation failures without leaving waiters pending', async () => {
        const harness = createRendererHarness()
        const session = createPreviewRenderSession({
            onResult: vi.fn(),
            getTheme: () => 'light',
            prepareHtml: () => Promise.reject(new Error('failed')),
            createRenderer: harness.createRenderer
        })

        const sequence = session.render('source')
        const published = session.whenPublished(sequence)
        harness.emit(sequence, '<p>raw</p>')

        await expect(published).resolves.toBe(false)
    })
})

import { describe, expect, it, vi } from 'vitest'
import { createMarkdownRenderer } from './markdownRenderer.js'

const createWorkerHarness = () => {
    const worker = {
        onmessage: null,
        onerror: null,
        postMessage: vi.fn(),
        terminate: vi.fn()
    }
    return { worker, createWorker: () => worker }
}

describe('createMarkdownRenderer', () => {
    it('waits until the requested render has been applied', async () => {
        const { worker, createWorker } = createWorkerHarness()
        const onResult = vi.fn()
        const renderer = createMarkdownRenderer({ onResult, createWorker })

        const sequence = renderer.render('target')
        const ready = renderer.whenApplied(sequence)
        worker.onmessage({ data: { seq: sequence, html: '<p>target</p>', toc: [] } })

        await expect(ready).resolves.toBe(true)
        expect(onResult).toHaveBeenCalledWith({ html: '<p>target</p>', toc: [] }, sequence)
    })

    it('lets a newer result satisfy older waiters and ignores a late stale result', async () => {
        const { worker, createWorker } = createWorkerHarness()
        const onResult = vi.fn()
        const renderer = createMarkdownRenderer({ onResult, createWorker })

        const first = renderer.render('first')
        const second = renderer.render('second')
        const firstReady = renderer.whenApplied(first)
        const secondReady = renderer.whenApplied(second)

        worker.onmessage({ data: { seq: second, html: '<p>second</p>', toc: [] } })
        worker.onmessage({ data: { seq: first, html: '<p>first</p>', toc: [] } })

        await expect(Promise.all([firstReady, secondReady])).resolves.toEqual([true, true])
        expect(onResult).toHaveBeenCalledTimes(1)
        expect(onResult).toHaveBeenLastCalledWith({ html: '<p>second</p>', toc: [] }, second)
    })

    it('falls back to the main-thread renderer when the worker fails', async () => {
        const { worker, createWorker } = createWorkerHarness()
        const onResult = vi.fn()
        const loadRenderer = vi.fn().mockResolvedValue({
            renderMarkdown: (source) => ({ html: `<p>${source}</p>`, toc: [] })
        })
        const renderer = createMarkdownRenderer({ onResult, createWorker, loadRenderer })

        const sequence = renderer.render('fallback')
        const ready = renderer.whenApplied(sequence)
        worker.onerror()

        await expect(ready).resolves.toBe(true)
        expect(worker.terminate).toHaveBeenCalledOnce()
        expect(onResult).toHaveBeenCalledWith({ html: '<p>fallback</p>', toc: [] }, sequence)
    })

    it('releases pending waiters when disposed', async () => {
        const { createWorker } = createWorkerHarness()
        const renderer = createMarkdownRenderer({ onResult: vi.fn(), createWorker })

        const ready = renderer.whenApplied(renderer.render('pending'))
        renderer.dispose()

        await expect(ready).resolves.toBe(false)
    })

    it('releases pending waiters when the fallback renderer cannot load', async () => {
        const renderer = createMarkdownRenderer({
            onResult: vi.fn(),
            createWorker: () => {
                throw new Error('unsupported')
            },
            loadRenderer: vi.fn().mockRejectedValue(new Error('load failed'))
        })

        await expect(renderer.whenApplied(renderer.render('unavailable'))).resolves.toBe(false)
    })
})

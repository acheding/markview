import { describe, expect, it, vi } from 'vitest'
import { createPreviewController } from './PreviewController.js'

const createContentHarness = () => {
    const contentEl = {
        scrollTop: 900,
        clientHeight: 500,
        querySelectorAll: vi.fn(),
        getBoundingClientRect: () => ({ top: 100, bottom: 600 }),
        scrollTo: vi.fn(({ top }) => {
            contentEl.scrollTop = top
        })
    }
    const block = (line, absoluteTop, height) => ({
        dataset: { sourceLine: String(line) },
        getBoundingClientRect: () => ({
            top: 100 + absoluteTop - contentEl.scrollTop,
            bottom: 100 + absoluteTop - contentEl.scrollTop + height
        })
    })
    const blocks = [block(1, 0, 800), block(100, 800, 300), block(200, 1200, 300)]
    contentEl.querySelectorAll.mockReturnValue(blocks)
    return { contentEl }
}

describe('PreviewController viewport snapshots', () => {
    it('restores the same source block offset after content above it changes height', () => {
        const { contentEl } = createContentHarness()
        const controller = createPreviewController({ contentEl })
        const snapshot = controller.captureViewport()

        expect(snapshot).toEqual({ line: 100, offset: -100, scrollTop: 900 })

        // 模拟 v-html 重建时 Mermaid 暂时收缩，浏览器滚动锚定把 scrollTop 改小。
        contentEl.scrollTop = 600
        expect(controller.restoreViewport(snapshot)).toBe(true)
        expect(contentEl.scrollTo).toHaveBeenLastCalledWith({ top: 900, behavior: 'auto' })
    })

    it('falls back to the captured scrollTop when there are no source blocks', () => {
        const { contentEl } = createContentHarness()
        contentEl.querySelectorAll.mockReturnValue([])
        const controller = createPreviewController({ contentEl })
        const snapshot = controller.captureViewport()

        contentEl.scrollTop = 120
        expect(controller.restoreViewport(snapshot)).toBe(true)
        expect(contentEl.scrollTop).toBe(900)
    })
})

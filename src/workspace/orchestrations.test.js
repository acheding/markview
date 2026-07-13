import { ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { createOrchestrations } from './orchestrations.js'

const deferred = () => {
    let resolve
    const promise = new Promise((settle) => {
        resolve = settle
    })
    return { promise, resolve }
}

const createHarness = ({ waitForPreviewReady = vi.fn().mockResolvedValue(true) } = {}) => {
    const search = {
        activeMatch: ref(null),
        setActiveMatch: vi.fn((result) => {
            search.activeMatch.value = {
                fileId: result.fileId,
                lineNumber: result.lineNumber,
                from: result.match.from,
                to: result.match.to,
                query: result.query
            }
        }),
        clearActiveMatch: vi.fn(() => {
            search.activeMatch.value = null
        })
    }
    const editor = {
        revealLineMeasured: vi.fn().mockResolvedValue(1240),
        revealLine: vi.fn(),
        focus: vi.fn()
    }
    const preview = {
        scrollTopForSourceLine: vi.fn().mockReturnValue(2180),
        scrollToSourceLine: vi.fn(),
        focus: vi.fn()
    }
    const scrollMaster = { alignToScrollTops: vi.fn().mockReturnValue(true) }
    const headings = {
        updateActiveHeading: vi.fn(),
        activeHeadingId: ref(''),
        clearHash: vi.fn()
    }
    const orchestrations = createOrchestrations({
        documents: { select: vi.fn(), clearContent: vi.fn() },
        search,
        layout: {
            isEditorCollapsed: ref(false),
            isScrollSyncEnabled: ref(true),
            editorPanelRef: ref(null),
            setScrollSyncEnabled: vi.fn(),
            setCollapsed: vi.fn()
        },
        headings,
        confirm: { ask: vi.fn() },
        getEditor: () => editor,
        getPreview: () => preview,
        getScrollMaster: () => scrollMaster,
        waitForPreviewReady
    })

    return { orchestrations, search, editor, preview, scrollMaster, waitForPreviewReady }
}

const result = {
    fileId: 'long-document',
    kind: 'line',
    lineNumber: 4800,
    match: { from: 12, to: 18 },
    query: 'target'
}

describe('search result orchestration', () => {
    it('waits for preview DOM before highlighting and aligns independently measured positions', async () => {
        const previewReady = deferred()
        const harness = createHarness({ waitForPreviewReady: vi.fn(() => previewReady.promise) })

        const revealing = harness.orchestrations.revealSearchResult(result)
        await Promise.resolve()
        await Promise.resolve()

        expect(harness.search.setActiveMatch).not.toHaveBeenCalled()
        previewReady.resolve(true)
        await revealing

        expect(harness.search.setActiveMatch).toHaveBeenCalledWith(result)
        expect(harness.editor.revealLineMeasured).toHaveBeenCalledWith(
            4800,
            expect.objectContaining({ match: { from: 12, to: 18 }, query: 'target', viewportRatio: 0.3 })
        )
        expect(harness.preview.scrollTopForSourceLine).toHaveBeenCalledWith(4800, { viewportRatio: 0.3 })
        expect(harness.scrollMaster.alignToScrollTops).toHaveBeenCalledWith(1240, 2180)
    })

    it('does not apply an older selection after a newer search navigation starts', async () => {
        const firstReady = deferred()
        const waitForPreviewReady = vi
            .fn()
            .mockImplementationOnce(() => firstReady.promise)
            .mockResolvedValueOnce(true)
        const harness = createHarness({ waitForPreviewReady })
        const newerResult = { ...result, fileId: 'newer-document', lineNumber: 24 }

        const firstReveal = harness.orchestrations.revealSearchResult(result)
        await Promise.resolve()
        await Promise.resolve()
        const secondReveal = harness.orchestrations.revealSearchResult(newerResult)
        await secondReveal
        firstReady.resolve(true)
        await firstReveal

        expect(harness.search.setActiveMatch).toHaveBeenCalledTimes(1)
        expect(harness.search.setActiveMatch).toHaveBeenCalledWith(newerResult)
        expect(harness.editor.revealLineMeasured).toHaveBeenCalledTimes(1)
        expect(harness.editor.revealLineMeasured).toHaveBeenCalledWith(24, expect.any(Object))
    })
})

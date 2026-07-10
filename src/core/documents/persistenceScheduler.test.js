import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SAVE_STATUS, createPersistenceScheduler } from './persistenceScheduler.js'

const flushMicrotasks = async () => {
    for (let i = 0; i < 10; i += 1) await Promise.resolve()
}

describe('createPersistenceScheduler', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    it('does nothing until enabled', () => {
        const save = vi.fn()
        const scheduler = createPersistenceScheduler({ getSnapshot: () => ({}), save })
        scheduler.schedule()
        vi.runAllTimers()
        expect(save).not.toHaveBeenCalled()
    })

    it('debounces and reports status transitions', async () => {
        const statuses = []
        const save = vi.fn().mockResolvedValue()
        const scheduler = createPersistenceScheduler({
            getSnapshot: () => ({ n: 1 }),
            save,
            debounceMs: 800,
            onStatus: (status) => statuses.push(status)
        })
        scheduler.setEnabled(true)

        scheduler.schedule()
        expect(statuses.at(-1)).toBe(SAVE_STATUS.UNSAVED)

        vi.advanceTimersByTime(800)
        await flushMicrotasks()

        expect(save).toHaveBeenCalledWith({ n: 1 })
        expect(statuses).toContain(SAVE_STATUS.SAVING)
        expect(statuses.at(-1)).toBe(SAVE_STATUS.SAVED)
    })

    it('marks failure when save rejects', async () => {
        const statuses = []
        const save = vi.fn().mockRejectedValue(new Error('boom'))
        vi.spyOn(console, 'warn').mockImplementation(() => {})
        const scheduler = createPersistenceScheduler({
            getSnapshot: () => ({}),
            save,
            onStatus: (status) => statuses.push(status)
        })
        scheduler.setEnabled(true)

        scheduler.flush({ markDirty: true })
        await flushMicrotasks()

        expect(statuses.at(-1)).toBe(SAVE_STATUS.FAILED)
    })

    it('flush writes immediately without waiting for the debounce', async () => {
        const save = vi.fn().mockResolvedValue()
        const scheduler = createPersistenceScheduler({ getSnapshot: () => ({}), save })
        scheduler.setEnabled(true)

        scheduler.schedule()
        scheduler.flush()
        await flushMicrotasks()

        expect(save).toHaveBeenCalledTimes(1)
    })
})

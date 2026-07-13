import { preparePreviewHtml } from '../preview/preparePreviewHtml.js'
import { createMarkdownRenderer } from './markdownRenderer.js'

export const createPreviewRenderSession = ({
    onResult,
    getTheme,
    prepareHtml = preparePreviewHtml,
    createRenderer = (handleResult) => createMarkdownRenderer({ onResult: handleResult })
}) => {
    let latestRequested = 0
    let latestRaw = null
    let published = 0
    let prepareRunId = 0
    let disposed = false
    let publishQueue = Promise.resolve()
    const waiters = []
    const failed = new Set()

    const settleThrough = (sequence, ready) => {
        for (let index = waiters.length - 1; index >= 0; index -= 1) {
            if (waiters[index].sequence <= sequence) {
                waiters.splice(index, 1)[0].resolve(ready)
            }
        }
    }

    const prepareAndPublish = async (raw) => {
        const runId = ++prepareRunId
        let preparedHtml
        try {
            preparedHtml = await prepareHtml(raw.result.html, getTheme())
        } catch {
            if (runId === prepareRunId) {
                failed.add(raw.sequence)
                settleThrough(raw.sequence, false)
            }
            return false
        }

        const publish = publishQueue
            .then(async () => {
                if (disposed || runId !== prepareRunId || raw.sequence !== latestRequested) return false

                await onResult({ ...raw.result, html: preparedHtml })
                if (disposed || runId !== prepareRunId || raw.sequence !== latestRequested) return false

                published = Math.max(published, raw.sequence)
                failed.delete(raw.sequence)
                settleThrough(published, true)
                return true
            })
            .catch(() => {
                if (runId === prepareRunId) {
                    failed.add(raw.sequence)
                    settleThrough(raw.sequence, false)
                }
                return false
            })
        publishQueue = publish
        return publish
    }

    const handleRawResult = (result, sequence) => {
        latestRaw = { result, sequence }
        if (sequence === latestRequested) void prepareAndPublish(latestRaw)
    }

    const renderer = createRenderer(handleRawResult)

    const render = (source) => {
        latestRequested = renderer.render(source)
        const sequence = latestRequested
        renderer.whenApplied(sequence).then((ready) => {
            if (!ready) {
                failed.add(sequence)
                settleThrough(sequence, false)
            }
        })
        return sequence
    }

    const refresh = () => {
        if (!latestRaw || latestRaw.sequence !== latestRequested) return Promise.resolve(false)
        return prepareAndPublish(latestRaw)
    }

    const whenPublished = (sequence) => {
        if (disposed) return Promise.resolve(false)
        if (sequence <= published) return Promise.resolve(true)
        if (failed.has(sequence)) return Promise.resolve(false)
        return new Promise((resolve) => waiters.push({ sequence, resolve }))
    }

    const dispose = () => {
        disposed = true
        prepareRunId += 1
        renderer.dispose()
        waiters.splice(0).forEach(({ resolve }) => resolve(false))
    }

    return { render, refresh, whenPublished, dispose }
}

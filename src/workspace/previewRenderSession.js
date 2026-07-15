import { MERMAID_MARKER, preparePreviewHtml } from '../preview/preparePreviewHtml.js'
import { createMarkdownRenderer } from './markdownRenderer.js'

export const createPreviewRenderSession = ({
    onResult,
    onEarlyPaint = () => {},
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

        // 含 Mermaid 的原始 HTML 需按需加载庞大的 mermaid 库并异步渲染成 SVG，耗时可达数百毫秒。
        // 首屏若整份等它，右侧会长时间停留在骨架屏。此处先把带占位块的原始 HTML 抢先交给调用方
        // 绘制一次（仅撤骨架屏、让文本立即可读）。抢先绘制不推进 published，定位类消费方走
        // whenPublished，仍等下方 SVG 就位后的最终发布，故定位精度不受影响。
        if (!disposed && raw.sequence === latestRequested && String(raw.result.html || '').includes(MERMAID_MARKER)) {
            onEarlyPaint(raw.result, raw.sequence)
        }

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

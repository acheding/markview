// Markdown 渲染调度：优先用 Web Worker（渲染在后台线程，主线程不卡顿），
// Worker 不可用时动态 import 同步渲染降级（保持主 bundle 精简，仅降级时才加载）。
// 用递增序号丢弃过期结果，避免快速输入时旧结果覆盖新结果。
export const createMarkdownRenderer = ({
    onResult,
    createWorker = () =>
        new Worker(new URL('../core/markdown/renderMarkdown.worker.js', import.meta.url), {
            type: 'module'
        }),
    loadRenderer = () => import('../core/markdown/renderMarkdown.js')
}) => {
    let worker = null
    let seq = 0
    let applied = 0
    let disposed = false
    let latestRequest = null
    const waiters = []

    const settleWaiters = (ready) => {
        for (let index = waiters.length - 1; index >= 0; index -= 1) {
            if (!ready || waiters[index].seq <= applied) {
                waiters.splice(index, 1)[0].resolve(ready)
            }
        }
    }

    const apply = (resultSeq, result) => {
        if (disposed || resultSeq < applied) return
        applied = resultSeq
        onResult(result, resultSeq)
        settleWaiters(true)
    }

    const renderWithoutWorker = (request) => {
        loadRenderer()
            .then(({ renderMarkdown }) => renderMarkdown(request.source))
            .then((result) => {
                if (!disposed) apply(request.seq, result)
            })
            .catch(() => settleWaiters(false))
    }

    try {
        worker = createWorker()
        worker.onmessage = (event) => apply(event.data.seq, { html: event.data.html, toc: event.data.toc })
        worker.onerror = () => {
            worker?.terminate()
            worker = null
            if (latestRequest && latestRequest.seq > applied) renderWithoutWorker(latestRequest)
        }
    } catch {
        worker = null
    }

    const render = (source) => {
        const currentSeq = (seq += 1)
        latestRequest = { seq: currentSeq, source }
        if (worker) {
            worker.postMessage(latestRequest)
        } else {
            renderWithoutWorker(latestRequest)
        }
        return currentSeq
    }

    // 等待指定请求（或更新的请求）实际写回。较新的结果已应用时，旧请求也视为完成。
    const whenApplied = (requestSeq) => {
        if (disposed) return Promise.resolve(false)
        if (requestSeq <= applied) return Promise.resolve(true)
        return new Promise((resolve) => waiters.push({ seq: requestSeq, resolve }))
    }

    const dispose = () => {
        disposed = true
        worker?.terminate()
        worker = null
        settleWaiters(false)
    }

    return { render, whenApplied, dispose }
}

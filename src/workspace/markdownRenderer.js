// Markdown 渲染调度：优先用 Web Worker（渲染在后台线程，主线程不卡顿），
// Worker 不可用时动态 import 同步渲染降级（保持主 bundle 精简，仅降级时才加载）。
// 用递增序号丢弃过期结果，避免快速输入时旧结果覆盖新结果。
export const createMarkdownRenderer = ({ onResult }) => {
    let worker = null
    let seq = 0
    let applied = 0

    const apply = (resultSeq, result) => {
        if (resultSeq < applied) return
        applied = resultSeq
        onResult(result)
    }

    try {
        worker = new Worker(new URL('../core/markdown/renderMarkdown.worker.js', import.meta.url), {
            type: 'module'
        })
        worker.onmessage = (event) => apply(event.data.seq, { html: event.data.html, toc: event.data.toc })
        worker.onerror = () => {
            worker?.terminate()
            worker = null
        }
    } catch {
        worker = null
    }

    const render = (source) => {
        const currentSeq = (seq += 1)
        if (worker) {
            worker.postMessage({ seq: currentSeq, source })
            return
        }
        // 降级：动态加载渲染器（不拖累主 bundle），异步返回。
        import('../core/markdown/renderMarkdown.js').then(({ renderMarkdown }) => {
            apply(currentSeq, renderMarkdown(source))
        })
    }

    const dispose = () => {
        worker?.terminate()
        worker = null
    }

    return { render, dispose }
}

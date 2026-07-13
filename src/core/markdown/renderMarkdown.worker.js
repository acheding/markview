import { renderMarkdown } from './renderMarkdown.js'

// Web Worker：把 Markdown 渲染（marked + KaTeX + highlight.js，纯 JS、零 DOM）搬离主线程，
// 大文档编辑时主线程不再卡顿。收 { seq, source }，回传 { seq, html, toc }。
self.onmessage = (event) => {
    const { seq, source } = event.data
    const { html, toc } = renderMarkdown(source)
    self.postMessage({ seq, html, toc })
}

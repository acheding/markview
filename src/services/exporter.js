import { getExportFileName } from '../core/documents/documentModel.js'
import { escapeHtml } from '../core/text.js'
import tokensCss from '../styles/tokens.css?inline'
import baseCss from '../styles/base.css?inline'
import markdownCss from '../styles/markdown.css?inline'
import highlightsCss from '../styles/highlights.css?inline'

// 数学公式字体较大，内联为 base64 会让文件膨胀，含公式时改引 CDN 样式（离线则公式退化为无字体降级）。
const KATEX_CDN = 'https://cdn.jsdelivr.net/npm/katex@0.17.0/dist/katex.min.css'

// 应用自有样式（设计 token + 正文排版 + 代码高亮）内联进导出稿，不依赖任何外部资源。
const APP_CSS = [tokensCss, baseCss, markdownCss, highlightsCss].join('\n')

// 导出稿专属版式：撑开整页、居中正文、隐藏无 JS 时失效的复制按钮。
const EXPORT_CSS = `
html, body { height: auto; overflow: visible; }
body { margin: 0; padding: 0; background: var(--color-bg); }
.markview-export {
    max-width: 860px;
    margin: 0 auto;
    padding: 40px 24px 80px;
    background: var(--color-surface);
}
.markview-export .code-copy { display: none; }
`

const triggerDownload = (data, filename, type) => {
    const blob = new Blob([data], { type })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    setTimeout(() => URL.revokeObjectURL(url), 0)
}

// 导出当前文档为 Markdown 文件（Blob + 下载链接）。
export const exportMarkdown = (file) => {
    if (!file) return
    triggerDownload(file.content || '', getExportFileName(file.name), 'text/markdown;charset=utf-8')
}

// 导出为自包含 HTML：取实时预览 DOM（已含渲染好的代码高亮 / Mermaid SVG / KaTeX），
// 内联应用样式，落地为可独立打开、离线可读的单文件。含公式时引 KaTeX CDN 补字体。
export const exportHtml = (contentEl, name, { theme = 'light' } = {}) => {
    if (!contentEl) return

    const title = getExportFileName(name || 'document.md').replace(/\.(md|markdown)$/i, '')
    const inner = contentEl.innerHTML
    const needsKatex = inner.includes('class="katex')
    const themeAttr = theme === 'dark' ? 'dark' : 'light'

    const doc = `<!doctype html>
<html lang="zh-CN" data-theme="${themeAttr}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
${needsKatex ? `<link rel="stylesheet" href="${KATEX_CDN}" crossorigin="anonymous">` : ''}
<style>${APP_CSS}</style>
<style>${EXPORT_CSS}</style>
</head>
<body>
<article class="markdown-body markview-export">${inner}</article>
</body>
</html>`

    triggerDownload(doc, `${title}.html`, 'text/html;charset=utf-8')
}

// 打印 / 打印为 PDF：借浏览器原生打印，产出文字可选、体积小的矢量输出。
// 版式由 styles/print.css 的 @media print 负责（隐藏应用外壳、撑开正文、分页避断）。
// 打印期间临时切浅色（省墨、避免深色背景被浏览器丢弃），打印结束或兜底超时后恢复。
export const printDocument = () => {
    if (typeof window === 'undefined') return

    const root = document.documentElement
    const previousTheme = root.dataset.theme

    let restored = false
    const restore = () => {
        if (restored) return
        restored = true
        if (previousTheme) root.dataset.theme = previousTheme
        else delete root.dataset.theme
        window.removeEventListener('afterprint', restore)
        clearTimeout(fallbackTimer)
    }

    root.dataset.theme = 'light'
    window.addEventListener('afterprint', restore)
    // afterprint 在部分浏览器不触发；打印对话框为模态时 print() 阻塞返回后兜底恢复。
    const fallbackTimer = setTimeout(restore, 1500)
    window.print()
}

// 把预览内容克隆到离屏容器，再用 html2pdf（懒加载）截图分页并下载。抛错交由调用方处理。
export const exportPdf = async (sourceEl, name) => {
    if (!sourceEl) return

    const baseName = getExportFileName(name || 'document.md').replace(/\.(md|markdown)$/i, '')
    const clone = sourceEl.cloneNode(true)
    clone.style.height = 'auto'
    clone.style.maxHeight = 'none'
    clone.style.overflow = 'visible'
    clone.style.width = `${sourceEl.clientWidth}px`

    const holder = document.createElement('div')
    holder.style.position = 'fixed'
    holder.style.left = '-99999px'
    holder.style.top = '0'
    holder.style.background = '#ffffff'
    holder.appendChild(clone)
    document.body.appendChild(holder)

    try {
        const { default: html2pdf } = await import('html2pdf.js')
        await html2pdf()
            .set({
                margin: [10, 10, 10, 10],
                filename: `${baseName}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
                pagebreak: { mode: ['css', 'legacy'], avoid: ['pre', 'table', 'img', 'blockquote'] }
            })
            .from(clone)
            .save()
    } finally {
        document.body.removeChild(holder)
    }
}

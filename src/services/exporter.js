import { getExportFileName } from '../core/documents/documentModel.js'

// 导出当前文档为 Markdown 文件（Blob + 下载链接）。
export const exportMarkdown = (file) => {
    if (!file) return

    const blob = new Blob([file.content || ''], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = getExportFileName(file.name)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    setTimeout(() => URL.revokeObjectURL(url), 0)
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

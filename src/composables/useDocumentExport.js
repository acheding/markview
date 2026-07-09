import { ref } from 'vue'

const getExportFileName = (name) => {
    const safeName = String(name || '')
        .replace(/[\\/:*?"<>|]/g, '-')
        .replace(/\s+/g, ' ')
        .trim()

    if (!safeName) return 'document.md'

    return /\.(md|markdown)$/i.test(safeName) ? safeName : `${safeName}.md`
}

export const useDocumentExport = ({ activeFile, getPreviewElement }) => {
    const isExportingPdf = ref(false)

    const exportActiveFile = () => {
        const file = activeFile.value
        if (!file) return

        const blob = new Blob([file.content || ''], { type: 'text/markdown;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')

        link.href = url
        link.download = getExportFileName(file.name)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        setTimeout(() => {
            URL.revokeObjectURL(url)
        }, 0)
    }

    // 把预览内容克隆到离屏容器，再用 html2pdf 截图分页并下载。
    const exportPdf = async () => {
        if (isExportingPdf.value) return

        const source = getPreviewElement()
        const file = activeFile.value
        if (!source) return

        isExportingPdf.value = true

        const baseName = getExportFileName(file?.name || 'document.md').replace(/\.(md|markdown)$/i, '')
        const clone = source.cloneNode(true)
        clone.style.height = 'auto'
        clone.style.maxHeight = 'none'
        clone.style.overflow = 'visible'
        clone.style.width = `${source.clientWidth}px`

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
        } catch (error) {
            console.warn('导出 PDF 失败:', error)
            alert('导出 PDF 失败，请重试。')
        } finally {
            document.body.removeChild(holder)
            isExportingPdf.value = false
        }
    }

    return {
        isExportingPdf,
        exportActiveFile,
        exportPdf
    }
}

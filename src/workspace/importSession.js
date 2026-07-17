import { watch } from 'vue'
import { isImageFile, isImportableTextFile } from '../core/documents/importableFile.js'

// 文件导入会话：导入按钮 / 拖拽 / PWA 双击打开三条入口共用的读取、分类与结果提示。
// 文本文件导入为新文档，图片插入当前文档，其余格式统一提示不支持；提示按场景合并为单条 toast。
// 「导入」始终是拷贝副本进工作区、与磁盘断开——与「打开」（fileSession，保留句柄可写回）并存而非二选一。
// disk（可选）仅用于 PWA 双击打开：支持写回时保留 launchQueue 句柄交给 disk，否则解析为 File 导入副本。
export const createImportSession = ({ documents, toast, getEditor, disk }) => {
    // 逐个把 File 读为文本、导入为新文档，返回成功/失败计数；不在此提示，交由调用方按场景合并。
    // 文档名由内容识别（见 documentSession.importFile），故此处不必依赖文件名。
    const runImport = async (files) => {
        let imported = 0
        let failed = 0
        for (const file of files) {
            try {
                const content = await file.text()
                documents.importFile({ name: file.name, content })
                imported += 1
            } catch (error) {
                console.warn('导入文件失败:', error)
                failed += 1
            }
        }
        return { imported, failed }
    }

    // 导入结果提示：单条 toast 会互相覆盖，故成功与失败合并为一条精确提示。
    // failed 汇总「读取失败」与「格式不支持」两类，统一按失败数呈现。
    const notifyImport = ({ imported, failed }) => {
        if (imported && failed) {
            // 部分成功：橙黄提醒而非红色报错。
            toast.show(`已导入 ${imported} 个文件，${failed} 个失败`, { tone: 'warning', duration: 3000 })
        } else if (failed) {
            toast.show(`${failed} 个文件导入失败`, { tone: 'error', duration: 3000 })
        } else if (imported) {
            toast.show(`已导入 ${imported} 个文件`, { tone: 'success' })
        }
    }

    // 「格式不支持」提示：导入按钮与拖拽导入共用，保证文案一致。
    const notifyUnsupported = () =>
        toast.show('不支持的文件格式，仅支持 .md / .markdown / 文本文件', { tone: 'warning', duration: 3000 })

    // 导入按钮 / 文件选择：过滤出可导入的文本文件，其余按「不支持」计入失败并提示。
    const importFiles = async (fileList) => {
        const files = Array.from(fileList || [])
        if (!files.length) return

        const textFiles = files.filter(isImportableTextFile)
        const unsupported = files.length - textFiles.length

        if (!textFiles.length) {
            notifyUnsupported()
            return
        }
        const { imported, failed } = await runImport(textFiles)
        notifyImport({ imported, failed: failed + unsupported })
    }

    // 命令面板 / 工具栏「导入文件」入口：动态建 input 唤起系统文件选择器导入副本，
    // 免去各组件重复维护隐藏 input；每次新建实例，重复选择同一文件也能触发 change。
    const openImportPicker = () => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.md,.markdown,text/markdown,text/plain'
        input.multiple = true
        input.addEventListener('change', () => importFiles(input.files), { once: true })
        input.click()
    }

    // 拖拽导入统一入口（页面任意位置）：文本文件导入为新文档；图片插入当前文档；其余格式提示不支持。
    // 有文件即返回 true 以消费 drop（拦截浏览器默认打开与编辑器默认拖放）；空拖拽返回 false 放行。
    const importDroppedFiles = (fileList) => {
        const files = Array.from(fileList || [])
        if (!files.length) return false

        const textFiles = files.filter(isImportableTextFile)
        const imageFiles = files.filter(isImageFile)
        // 既非文本、又非图片的即「格式不支持」。
        const unsupported = files.length - textFiles.length - imageFiles.length

        // 图片插入活动文档（拖到编辑区内外均可）；超限/失败提示由编辑器 onImageNotify 负责。
        if (imageFiles.length) getEditor()?.insertImages(imageFiles)

        if (textFiles.length) {
            // 异步导入，完成后连同不支持数量一并提示。
            runImport(textFiles).then(({ imported, failed }) =>
                notifyImport({ imported, failed: failed + unsupported })
            )
        } else if (unsupported && !imageFiles.length) {
            // 纯不支持格式（无图片可插）：明确提示。
            notifyUnsupported()
        }

        return true
    }

    // 等待首屏 hydrate 完成（isReady 置真）再继续，避免导入被随后到达的初始状态覆盖。
    const whenDocumentsReady = () => {
        if (documents.isReady.value) return Promise.resolve()
        return new Promise((resolve) => {
            const stop = watch(
                () => documents.isReady.value,
                (ready) => {
                    if (ready) {
                        stop()
                        resolve()
                    }
                }
            )
        })
    }

    // —— PWA 文件处理（File Handling API）——
    // 从系统双击 .md / .markdown 打开时，launchQueue 把文件句柄交给这里。
    // 支持写回时保留句柄交给 disk（同文件去重 + 建立关联）；否则解析为 File 导入副本。
    const consumeLaunchFiles = async (launchParams) => {
        const handles = launchParams?.files
        if (!handles?.length) return

        await whenDocumentsReady()

        if (disk?.isSupported) {
            await disk.openViaHandles(handles)
            return
        }

        const files = []
        for (const handle of handles) {
            try {
                files.push(await handle.getFile())
            } catch (error) {
                console.warn('打开文件失败:', error)
            }
        }

        const { imported } = await runImport(files)
        if (imported) {
            toast.show(imported > 1 ? `已打开 ${imported} 个文件` : '已打开文件', { tone: 'success' })
        }
    }

    const setupFileHandling = () => {
        if (typeof window === 'undefined' || !('launchQueue' in window)) return
        window.launchQueue.setConsumer(consumeLaunchFiles)
    }

    return { importFiles, openImportPicker, importDroppedFiles, setupFileHandling }
}

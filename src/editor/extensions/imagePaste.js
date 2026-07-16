import { EditorView } from '@codemirror/view'
import { compressImageToDataUrl } from './imageCompress.js'

// 粘贴 / 拖拽图片 → 压缩为 base64 data URL，插入 Markdown 图片语法。
// 契合无后端定位：图片随文档一起存本地（IndexedDB），分享 / 导出自包含。
// 两道闸：
//  1) 输入上限——挡住 decode 超大文件的内存峰值（TIFF 等格式浏览器甚至无法 decode）。
//  2) 输出上限——压完仍过大（浏览器压不动的 TIFF 会回退成原图）就拒绝内联，
//     否则几十 MB 的单行 base64 会撑爆 marked 解析（Maximum call stack size exceeded）。
const MAX_IMAGE_MB = 30
const MAX_IMAGE_BYTES = MAX_IMAGE_MB * 1024 * 1024
const MAX_INLINE_MB = 6
const MAX_INLINE_CHARS = MAX_INLINE_MB * 1024 * 1024

const imageFilesOf = (dataTransfer) =>
    dataTransfer ? Array.from(dataTransfer.files || []).filter((file) => file.type.startsWith('image/')) : []

// 用文件名（去扩展名）作 alt；清掉会破坏 Markdown 链接语法的方括号。
const deriveAlt = (file) => (file.name ? file.name.replace(/\.[^.]+$/, '') : 'image').replace(/[[\]]/g, '').trim()

// 压缩一组图片为内联 base64、拼成 Markdown 图片语法；按拒绝原因提示。返回可插入文本（可能为空串）。
// 只产出文本、不关心插入位置，故与具体视图解耦——供编辑器粘贴与全局拖拽导入共用。
export const compressImagesToMarkdown = async (files, { onNotify } = {}) => {
    const snippets = []
    // 按原因分别计数，提示才能精确——否则「压不动被拦」会被误报成「超过 30MB」。
    let tooLarge = 0
    let cannotInline = 0
    let failed = 0

    for (const file of files) {
        if (file.size > MAX_IMAGE_BYTES) {
            tooLarge += 1
            continue
        }
        try {
            const dataUrl = await compressImageToDataUrl(file)
            // 压完仍超过内联上限：多为 TIFF 等浏览器压不动、回退原图的格式。直接内联会撑爆解析，故拒绝。
            if (dataUrl.length > MAX_INLINE_CHARS) {
                cannotInline += 1
                continue
            }
            snippets.push(`![${deriveAlt(file) || 'image'}](${dataUrl})`)
        } catch {
            failed += 1
        }
    }

    const reasons = []
    if (tooLarge) reasons.push(`${tooLarge} 张图片超过 ${MAX_IMAGE_MB}MB`)
    if (cannotInline) reasons.push(`${cannotInline} 张图片过大且无法压缩`)
    if (failed) reasons.push(`${failed} 张图片读取失败`)
    if (reasons.length) onNotify?.(`${reasons.join('，')}，未插入`)

    return snippets.join('\n')
}

// 粘贴图片 → 在光标处插入。拖拽图片改由全局统一入口处理（见 workspace.importDroppedFiles），
// 故此处不再注册 drop，避免与全局拖放两套逻辑冲突。
export const createImagePaste = ({ onNotify } = {}) => {
    const insertImages = async (view, files, range) => {
        const insert = await compressImagesToMarkdown(files, { onNotify })
        if (!insert) return
        // 异步读取期间文档可能已改变，dispatch 前把区间钳制到当前文档长度，避免越界报错。
        const docLength = view.state.doc.length
        const from = Math.min(range.from, docLength)
        const to = Math.min(range.to, docLength)
        view.dispatch({
            changes: { from, to, insert },
            selection: { anchor: from + insert.length }
        })
        view.focus()
    }

    return EditorView.domEventHandlers({
        paste(event, view) {
            const files = imageFilesOf(event.clipboardData)
            if (!files.length) return false
            event.preventDefault()
            const selection = view.state.selection.main
            insertImages(view, files, { from: selection.from, to: selection.to })
            return true
        }
    })
}

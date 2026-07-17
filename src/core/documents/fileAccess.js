// File System Access API 封装（纯逻辑，无 Vue、无应用状态）。
// 桌面 Chromium 系支持句柄读写；Firefox / Safari 不支持时由调用方降级为导入副本/下载导出。

// 「打开/另存为」选择器需要 window.show*FilePicker；launchQueue 句柄的写回只需 createWritable。
export const isFileSystemAccessSupported = () =>
    typeof window !== 'undefined' &&
    typeof window.showOpenFilePicker === 'function' &&
    typeof window.showSaveFilePicker === 'function'

// launchQueue / 拖拽等外部来源的句柄是否可写回（防御非 Chromium 实现给出只读句柄）。
export const isWritableFileHandle = (handle) =>
    Boolean(handle && handle.kind === 'file' && typeof handle.createWritable === 'function')

// 内容签名（FNV-1a + 长度）：判断「当前内容是否与上次写回磁盘时一致」。
// 只用于同一会话内的脏检查，不做跨端一致性保证，碰撞概率可忽略。
export const contentSignature = (value = '') => {
    const text = String(value)
    let hash = 2166136261

    for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index)
        hash = Math.imul(hash, 16777619)
    }

    return `${text.length}:${(hash >>> 0).toString(36)}`
}

// —— 权限 ——
// 旧实现无 query/requestPermission 时视为已授权（能拿到句柄即能读写）。
export const queryFilePermission = async (handle) => {
    if (typeof handle?.queryPermission !== 'function') return 'granted'
    return handle.queryPermission({ mode: 'readwrite' })
}

// 必须在用户手势（keydown/click 等）内调用，否则浏览器直接拒绝。
export const requestFilePermission = async (handle) => {
    if (typeof handle?.requestPermission !== 'function') return 'granted'
    return handle.requestPermission({ mode: 'readwrite' })
}

// —— 读 / 写 ——
export const readFileHandle = async (handle) => {
    const file = await handle.getFile()
    return { name: file.name, content: await file.text(), lastModified: file.lastModified }
}

// 只取 mtime 不读内容：写回前的外部修改快检、focus 时的轻量轮询。
export const statFileHandle = async (handle) => {
    const file = await handle.getFile()
    return { name: file.name, lastModified: file.lastModified }
}

// 写回并返回写后的磁盘 mtime（作为下次外部修改检测的基准）。
export const writeFileHandle = async (handle, content) => {
    const writable = await handle.createWritable()
    await writable.write(content)
    await writable.close()
    const file = await handle.getFile()
    return { lastModified: file.lastModified }
}

// —— 选择器 ——
const MARKDOWN_PICKER_TYPES = [
    {
        description: 'Markdown',
        accept: { 'text/markdown': ['.md', '.markdown'] }
    }
]

// 用户取消（AbortError）返回空数组/null，调用方静默即可；其余异常照常抛出。
const isPickerCancel = (error) => error?.name === 'AbortError'

export const pickOpenFiles = async () => {
    try {
        return await window.showOpenFilePicker({ multiple: true, types: MARKDOWN_PICKER_TYPES })
    } catch (error) {
        if (isPickerCancel(error)) return []
        throw error
    }
}

export const pickSaveFile = async (suggestedName) => {
    try {
        return await window.showSaveFilePicker({ suggestedName, types: MARKDOWN_PICKER_TYPES })
    } catch (error) {
        if (isPickerCancel(error)) return null
        throw error
    }
}

// 两个句柄是否指向磁盘上同一文件（同文件去重）；实现缺失时按不同文件处理。
export const isSameFileEntry = async (a, b) => {
    if (!a || !b || typeof a.isSameEntry !== 'function') return false
    try {
        return await a.isSameEntry(b)
    } catch {
        return false
    }
}

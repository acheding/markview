// 文件导入的类型判定：仅读取 name / type，不依赖浏览器 File 类型，故为纯逻辑、可直测。
const TEXT_FILE_PATTERN = /\.(md|markdown|mdown|mkd|txt|text)$/i

// 能否作为文档导入：按扩展名或文本 MIME 识别，排除图片。
// .md 在部分系统下 MIME 为空，故以扩展名为主、文本 MIME 兜底。
export const isImportableTextFile = ({ name = '', type = '' } = {}) => {
    if (type.startsWith('image/')) return false
    if (TEXT_FILE_PATTERN.test(name)) return true
    return type.startsWith('text/')
}

// 是否图片：拖入图片插入当前文档，不按"不支持"处理。
export const isImageFile = ({ type = '' } = {}) => type.startsWith('image/')

// 拖拽进行中（dragenter/over）浏览器只暴露 MIME type、拿不到文件名。
// 是否存在非图片文件 → 决定是否展示放置蒙层：图片直接插入当前文档、不显示蒙层；
// 文本及其他文件都显示蒙层（松开后各自导入为新文档或提示不支持）。
export const dragHasNonImageFile = (types = []) => types.some((type) => !type.startsWith('image/'))

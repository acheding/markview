export const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

export const escapeHtml = (value = '') =>
    String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')

export const stripHtml = (value = '') =>
    String(value)
        .replace(/<[^>]*>/g, '')
        .trim()

export const countWords = (value = '') => {
    const words = value.match(/[一-龥]|[a-zA-Z]+(?:['’][a-zA-Z]+)?/g)
    return words ? words.length : 0
}

// 内联图片的 base64 数据不是可读正文，统计字数 / 字符前应剔除，
// 否则单张图能顶几百万字符，让统计彻底失真。仅去掉数据段，其余 Markdown 语法照常计入。
const IMAGE_DATA_URL_RE = /data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/g

export const stripImageData = (value = '') => String(value).replace(IMAGE_DATA_URL_RE, '')

// 统计 Markdown 图片数量（![alt](url)），内联 base64 与普通链接图片都算。
// base64 字符集不含 ')'，故 [^)]* 不会误吞后续内容。
const IMAGE_SYNTAX_RE = /!\[[^\]]*\]\([^)]*\)/g

export const countImages = (value = '') => (String(value).match(IMAGE_SYNTAX_RE) || []).length

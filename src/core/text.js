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

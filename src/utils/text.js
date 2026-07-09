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

export const createSlugger = () => {
    const used = new Map()

    return (value) => {
        const base =
            stripHtml(value)
                .toLowerCase()
                .trim()
                .replace(/[^\p{L}\p{N}\s-]/gu, '')
                .replace(/\s+/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '') || 'heading'

        const count = used.get(base) || 0
        used.set(base, count + 1)

        return count === 0 ? base : `${base}-${count}`
    }
}

export const countWords = (value = '') => {
    const words = value.match(/[\u4e00-\u9fa5]|[a-zA-Z]+(?:['’][a-zA-Z]+)?/g)
    return words ? words.length : 0
}

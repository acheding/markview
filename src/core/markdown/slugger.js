import { stripHtml } from '../text.js'

// 标题 slug 生成器：同名标题自动追加序号，保证 id 唯一。
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

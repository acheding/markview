import { describe, expect, it } from 'vitest'
import { decodeShareHash, encodeSharePayload } from './shareLink.js'

describe('shareLink', () => {
    it('round-trips name and content through the hash', () => {
        const doc = { name: '测试.md', content: '# 标题\n\n$E=mc^2$ 与 ```mermaid\nA-->B\n```' }
        const hash = `#share=${encodeSharePayload(doc)}`
        expect(decodeShareHash(hash)).toEqual(doc)
    })

    it('round-trips an anchor for 定位分享链接', () => {
        const doc = { name: '测试.md', content: '# 标题\n## 小节', anchor: '小节' }
        const hash = `#share=${encodeSharePayload(doc)}`
        expect(decodeShareHash(hash)).toEqual(doc)
    })

    it('omits the anchor field when not provided', () => {
        const hash = `#share=${encodeSharePayload({ name: 'a.md', content: 'x' })}`
        expect(decodeShareHash(hash)).not.toHaveProperty('anchor')
    })

    it('returns null for non-share hashes', () => {
        expect(decodeShareHash('#某标题')).toBeNull()
        expect(decodeShareHash('')).toBeNull()
    })

    it('returns null for corrupted share data', () => {
        expect(decodeShareHash('#share=not-valid-lz')).toBeNull()
    })

    it('falls back to a default name when missing', () => {
        const hash = `#share=${encodeSharePayload({ name: '', content: 'hi' })}`
        expect(decodeShareHash(hash)).toEqual({ name: '分享文档.md', content: 'hi' })
    })
})

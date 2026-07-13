import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'

// URL 分享：把文档压缩进 hash，链接自包含、无需后端。编解码为纯函数（URL 拼接在调用方完成）。
const SHARE_PREFIX = 'share='

// 文档 → 可安全放进 URL 的压缩串（lz-string 的 URI 变体，无需再 encodeURIComponent）。
export const encodeSharePayload = ({ name, content }) => {
    const payload = JSON.stringify({ n: name || '', c: content || '' })
    return compressToEncodedURIComponent(payload)
}

// location.hash → 分享文档；非分享 hash 或数据损坏则返回 null。
export const decodeShareHash = (hash = '') => {
    const raw = hash.startsWith('#') ? hash.slice(1) : hash
    if (!raw.startsWith(SHARE_PREFIX)) return null

    try {
        const json = decompressFromEncodedURIComponent(raw.slice(SHARE_PREFIX.length))
        if (!json) return null
        const data = JSON.parse(json)
        return {
            name: typeof data.n === 'string' && data.n ? data.n : '分享文档.md',
            content: typeof data.c === 'string' ? data.c : ''
        }
    } catch {
        return null
    }
}

export const SHARE_HASH_PREFIX = SHARE_PREFIX

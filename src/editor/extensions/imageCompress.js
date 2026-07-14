// 粘贴 / 拖拽的图片先压缩再内联：缩放到最大边长 + WebP 有损编码，大幅减小 base64 体积
//（截图常是无损 PNG，压缩后往往能小一个数量级）。纯前端、零依赖，契合无后端定位。
const MAX_DIMENSION = 2048
const QUALITY = 0.92
// 只对超过此大小的图片压缩：多数截图 / 图片在 1MB 以内，直接内联原图以保真，
// 避免文字 / UI 截图被有损编码糊边；只有真正的大图才压。
const COMPRESS_MIN_BYTES = 1024 * 1024

const readAsDataUrl = (file) =>
    new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(file)
    })

// 返回压缩后的 data URL；无法压缩（GIF 动图 / decode 失败 / 反而更大）时回退原图。
export const compressImageToDataUrl = async (file) => {
    const original = await readAsDataUrl(file)

    // GIF 动图（canvas 只能取一帧，避免丢帧）与小图直接内联原图，不压缩。
    if (file.type === 'image/gif' || file.size < COMPRESS_MIN_BYTES) return original

    try {
        const bitmap = await createImageBitmap(file)
        const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
        const width = Math.max(1, Math.round(bitmap.width * scale))
        const height = Math.max(1, Math.round(bitmap.height * scale))

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height)
        bitmap.close?.()

        // WebP：压缩率高且保留透明通道；浏览器不支持时 toDataURL 自动回退 PNG。
        const compressed = canvas.toDataURL('image/webp', QUALITY)

        // 取更小者：小图压缩后可能反而更大。
        return compressed.length < original.length ? compressed : original
    } catch {
        return original
    }
}

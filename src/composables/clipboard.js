// 复制文本到剪贴板：优先 async Clipboard API（需安全上下文：HTTPS 或 localhost），
// 局域网 HTTP 等非安全上下文下 navigator.clipboard 不可用，降级到 execCommand。
export const copyText = async (text) => {
    try {
        if (window.isSecureContext && navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text)
            return true
        }
    } catch {
        // 落到 execCommand 降级
    }

    try {
        const textarea = document.createElement('textarea')
        textarea.value = text
        textarea.setAttribute('readonly', '')
        textarea.style.position = 'fixed'
        textarea.style.top = '-1000px'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        const ok = document.execCommand('copy')
        document.body.removeChild(textarea)
        return ok
    } catch {
        return false
    }
}

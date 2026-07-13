import { ref } from 'vue'

const DEFAULT_DURATION_MS = 2200

// 轻量瞬时提示会话：单条 toast 的文案、可见性与自动消隐计时。
// 纯响应式状态，UI 由 AppToast 消费；再次 show 会重置计时并复用同一条。
export const createToastSession = () => {
    const message = ref('')
    const tone = ref('info')
    const visible = ref(false)
    let hideTimer = null

    const show = (text, { tone: nextTone = 'info', duration = DEFAULT_DURATION_MS } = {}) => {
        message.value = text
        tone.value = nextTone
        visible.value = true
        clearTimeout(hideTimer)
        hideTimer = setTimeout(() => {
            visible.value = false
        }, duration)
    }

    const dismiss = () => {
        visible.value = false
        clearTimeout(hideTimer)
        hideTimer = null
    }

    const dispose = () => {
        clearTimeout(hideTimer)
        hideTimer = null
    }

    return { message, tone, visible, show, dismiss, dispose }
}

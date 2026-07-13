import { ref } from 'vue'

const DEFAULT_OPTIONS = {
    title: '',
    message: '',
    confirmLabel: '确定',
    cancelLabel: '取消',
    tone: 'default'
}

// 自定义确认框会话：替代原生 confirm()。ask() 打开对话框并返回 Promise<boolean>，
// 由 AppConfirm 组件的按钮 / 键盘操作 resolve。同一时刻只维持一个待决 Promise。
export const createConfirmSession = () => {
    const visible = ref(false)
    const options = ref({ ...DEFAULT_OPTIONS })
    let resolver = null

    const ask = (opts = {}) => {
        // 前一个未决对话框视为取消，避免 resolver 泄漏。
        settle(false)
        options.value = { ...DEFAULT_OPTIONS, ...opts }
        visible.value = true
        return new Promise((resolve) => {
            resolver = resolve
        })
    }

    function settle(result) {
        if (!resolver) return
        visible.value = false
        const resolve = resolver
        resolver = null
        resolve(result)
    }

    const confirm = () => settle(true)
    const cancel = () => settle(false)
    const dispose = () => settle(false)

    return { visible, options, ask, confirm, cancel, dispose }
}

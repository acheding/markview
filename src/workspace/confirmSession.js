import { ref } from 'vue'

const DEFAULT_OPTIONS = {
    title: '',
    message: '',
    confirmLabel: '确定',
    cancelLabel: '取消',
    tone: 'default'
}

// 自定义确认框会话：替代原生 confirm()。ask() 打开对话框并返回 Promise<true|false|null>：
// true = 确认按钮，false = 取消按钮，null = 未做选择（Esc / 点遮罩 / 被顶掉）。
// 常规二选一场景 `if (!ok)` 即可（null 与取消同路）；当取消按钮承载具体动作
// （如「取消关联」）时，用 === false 区分「明确选择」与「关掉对话框」。
// 由 AppConfirm 组件的按钮 / 键盘操作 resolve。同一时刻只维持一个待决 Promise。
export const createConfirmSession = () => {
    const visible = ref(false)
    const options = ref({ ...DEFAULT_OPTIONS })
    let resolver = null

    const ask = (opts = {}) => {
        // 前一个未决对话框按「未做选择」收尾，避免 resolver 泄漏。
        settle(null)
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
    const dismiss = () => settle(null)
    const dispose = () => settle(null)

    return { visible, options, ask, confirm, cancel, dismiss, dispose }
}

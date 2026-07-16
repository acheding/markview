import { ref } from 'vue'

const STORAGE_KEY = 'markview:command-usage'

const read = () => {
    try {
        const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY))
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed
    } catch {
        // localStorage 不可用或数据损坏：按无记录处理
    }
    return {}
}

// 命令使用计数：模块级单例，命令面板据此按使用习惯排序。
const usage = ref(read())

export const useCommandUsage = () => {
    const recordUse = (id) => {
        // 整体替换以触发响应式更新
        usage.value = { ...usage.value, [id]: (usage.value[id] || 0) + 1 }
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(usage.value))
        } catch {
            // 写入失败则仅当次会话生效
        }
    }

    const usageOf = (id) => usage.value[id] || 0

    return { recordUse, usageOf }
}

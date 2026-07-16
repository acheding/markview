import { ref, watch } from 'vue'

const STORAGE_KEY = 'markview:theme'

const readStored = () => {
    try {
        const stored = window.localStorage.getItem(STORAGE_KEY)
        if (stored === 'dark' || stored === 'light') return stored
    } catch {
        // localStorage 不可用则忽略，走系统偏好
    }
    return null
}

const prefersDark = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches

// 初始主题：优先本地记忆，其次跟随系统。
const theme = ref(readStored() || (prefersDark() ? 'dark' : 'light'))

// PWA 窗口标题栏颜色（meta theme-color）：与顶栏 --color-surface-glass 的实际底色对齐，
// 浅色沿用 manifest 的 theme_color；index.html 内联脚本也用同一组色值。
const THEME_COLORS = { light: '#dbe3f7', dark: '#1e1e21' }

const applyTheme = (value) => {
    if (typeof document !== 'undefined') {
        document.documentElement.dataset.theme = value
        const meta = document.querySelector('meta[name="theme-color"]')
        if (meta) meta.content = THEME_COLORS[value] || THEME_COLORS.light
    }
}

// 模块加载即应用一次（App 挂载前 index.html 内联脚本已设过，这里保证与响应式状态同步）。
applyTheme(theme.value)

watch(theme, (value) => {
    applyTheme(value)
    try {
        window.localStorage.setItem(STORAGE_KEY, value)
    } catch {
        // 写入失败则忽略，仅当次会话生效
    }
})

// 主题偏好：模块级单例，任意组件调用共享同一状态。
export const useTheme = () => {
    const toggleTheme = () => {
        theme.value = theme.value === 'dark' ? 'light' : 'dark'
    }

    return { theme, toggleTheme }
}

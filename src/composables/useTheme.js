import { nextTick, ref, watch } from 'vue'

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

// —— 主题切换圆形扩散（View Transitions API）——
// 不支持的浏览器与 reduce-motion 用户自动退回瞬时切换。
const REVEAL_DURATION_MS = 480

const prefersReducedMotion = () =>
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// 扩散圆心：优先本次事件的目标元素（工具栏主题按钮）；
// 快捷键 / 命令面板触发时无事件，回退到页面上的主题按钮，最后取视口中心。
const resolveRevealOrigin = (event) => {
    const el =
        (event?.currentTarget instanceof Element ? event.currentTarget : null) ||
        document.querySelector('.theme-toggle')
    const rect = el?.getBoundingClientRect()
    if (rect && (rect.width || rect.height)) {
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    }
    return { x: window.innerWidth / 2, y: window.innerHeight / 2 }
}

const playReveal = (transition, { x, y }) => {
    // 半径取圆心到最远屏幕角的距离，保证扩散圆能盖满全屏
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))
    transition.ready
        .then(() => {
            // 新主题快照按 clip-path 从圆心揭开；旧主题静止铺底（默认交叉淡入已在 base.css 禁用）
            document.documentElement.animate(
                { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
                { duration: REVEAL_DURATION_MS, easing: 'ease-in-out', pseudoElement: '::view-transition-new(root)' }
            )
        })
        .catch(() => {
            // transition 被跳过（如连续快速切换）时 ready 会 reject；主题本身已生效，忽略即可
        })
}

// 主题偏好：模块级单例，任意组件调用共享同一状态。
export const useTheme = () => {
    const toggleTheme = (event) => {
        const next = theme.value === 'dark' ? 'light' : 'dark'

        if (typeof document === 'undefined' || !document.startViewTransition || prefersReducedMotion()) {
            theme.value = next
            return
        }

        const origin = resolveRevealOrigin(event)
        // 回调内等 Vue 完成 DOM 更新（data-theme 与切换图标都换好）再拍新快照
        const transition = document.startViewTransition(async () => {
            theme.value = next
            await nextTick()
        })
        playReveal(transition, origin)
    }

    return { theme, toggleTheme }
}

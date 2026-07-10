import { inject } from 'vue'

export const WORKSPACE_KEY = Symbol('markview-workspace')

// 组件通过 useWorkspace() 直接消费文档/搜索/布局/编排，消除逐层事件透传。
export const useWorkspace = () => {
    const workspace = inject(WORKSPACE_KEY)
    if (!workspace) {
        throw new Error('useWorkspace() 必须在 provide(WORKSPACE_KEY) 的组件树内调用')
    }
    return workspace
}

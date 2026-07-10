import { onBeforeUnmount, onMounted, ref } from 'vue'

// 响应式包装 matchMedia：返回一个随媒体查询匹配状态变化的 ref。
export const useMediaQuery = (query, initial = true) => {
    const matches = ref(initial)
    let mediaQuery = null

    const sync = () => {
        matches.value = mediaQuery ? mediaQuery.matches : initial
    }

    onMounted(() => {
        mediaQuery = window.matchMedia(query)
        sync()
        mediaQuery.addEventListener('change', sync)
    })

    onBeforeUnmount(() => {
        mediaQuery?.removeEventListener('change', sync)
    })

    return matches
}

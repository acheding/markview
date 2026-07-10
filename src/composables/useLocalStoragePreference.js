import { ref, watch } from 'vue'

const canUseLocalStorage = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'

// 自动读写 localStorage 的偏好 ref。
export const useLocalStoragePreference = (key, defaultValue) => {
    const value = ref(defaultValue)

    if (canUseLocalStorage()) {
        try {
            const storedValue = window.localStorage.getItem(key)
            if (storedValue !== null) {
                value.value = JSON.parse(storedValue)
            }
        } catch (error) {
            console.warn(`Failed to read localStorage preference "${key}":`, error)
        }
    }

    watch(
        value,
        (nextValue) => {
            if (!canUseLocalStorage()) return

            try {
                window.localStorage.setItem(key, JSON.stringify(nextValue))
            } catch (error) {
                console.warn(`Failed to write localStorage preference "${key}":`, error)
            }
        },
        { flush: 'post' }
    )

    return value
}

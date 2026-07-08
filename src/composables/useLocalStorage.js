import { ref, watch } from 'vue'

export const useLocalStorage = (key, fallbackValue) => {
    const saveStatus = ref('已自动保存')
    const value = ref(fallbackValue)

    try {
        const storedValue = localStorage.getItem(key)
        if (storedValue !== null) {
            value.value = storedValue
        }
    } catch (error) {
        saveStatus.value = '读取失败'
        console.warn('localStorage 读取失败:', error)
    }

    watch(value, (nextValue) => {
        try {
            localStorage.setItem(key, nextValue)
            saveStatus.value = '已自动保存'
        } catch (error) {
            saveStatus.value = '保存失败'
            console.warn('localStorage 写入失败:', error)
        }
    })

    return {
        value,
        saveStatus,
    }
}

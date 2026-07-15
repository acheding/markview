import { onBeforeUnmount, onMounted, watch } from 'vue'
import { SAVE_STATUS } from '../core/documents/persistenceScheduler.js'

const APP_NAME = 'MarkView'
// 标签页失焦时，在正常标题前加一个颜文字作为「等你回来」的小提示。
const AWAY_PREFIX = '(´･ω･) '
// 未保存 / 保存中时标题前缀的小圆点。
const DIRTY_MARK = '● '

// 动态网页标题：`● 文件名`（有未保存改动时带圆点），
// 切走标签页时在标题前追加颜文字。依赖 documents 会话的响应式状态。
export const useDocumentTitle = ({ activeFile, saveStatus }) => {
    let isAway = false

    const composeTitle = () => {
        const name = activeFile.value?.name?.trim() || '未命名文档'
        const dirty = saveStatus.value === SAVE_STATUS.UNSAVED || saveStatus.value === SAVE_STATUS.SAVING
        return `${dirty ? DIRTY_MARK : ''}${name}`
    }

    const apply = () => {
        const title = composeTitle()
        document.title = isAway ? `${AWAY_PREFIX}${title}` : title
    }

    const handleVisibility = () => {
        isAway = document.visibilityState === 'hidden'
        apply()
    }

    watch([activeFile, saveStatus], apply, { immediate: true })

    onMounted(() => {
        document.addEventListener('visibilitychange', handleVisibility)
    })

    onBeforeUnmount(() => {
        document.removeEventListener('visibilitychange', handleVisibility)
        document.title = APP_NAME
    })
}

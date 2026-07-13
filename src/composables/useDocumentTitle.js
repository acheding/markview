import { onBeforeUnmount, onMounted, watch } from 'vue'
import { SAVE_STATUS } from '../core/documents/persistenceScheduler.js'

const APP_NAME = 'MarkView'
// 标签页失焦时的挽留文案（切回来即恢复正常标题）。
const AWAY_TITLE = '(´･ω･) 回来继续呀~'
// 未保存 / 保存中时标题前缀的小圆点。
const DIRTY_MARK = '● '

// 动态网页标题：`● 文件名 · MarkView`（有未保存改动时带圆点），
// 切走标签页时换成挽留文案。依赖 documents 会话的响应式状态。
export const useDocumentTitle = ({ activeFile, saveStatus }) => {
    let isAway = false

    const composeTitle = () => {
        const name = activeFile.value?.name?.trim() || '未命名文档'
        const dirty = saveStatus.value === SAVE_STATUS.UNSAVED || saveStatus.value === SAVE_STATUS.SAVING
        return `${dirty ? DIRTY_MARK : ''}${name} · ${APP_NAME}`
    }

    const apply = () => {
        document.title = isAway ? AWAY_TITLE : composeTitle()
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

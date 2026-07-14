import { computed, ref } from 'vue'
import {
    createDocument,
    createInitialState,
    createUniqueName,
    deriveDocumentName,
    normalizeState,
    snapshotState
} from '../core/documents/documentModel.js'
import { isIndexedDbSupported, loadDocumentState, saveDocumentState } from '../core/documents/documentStore.js'
import { SAVE_STATUS, createPersistenceScheduler } from '../core/documents/persistenceScheduler.js'
import { reconcileDocumentState } from '../core/documents/reconcile.js'
import { countImages, countWords, stripImageData } from '../core/text.js'
import { PRESET_DOCUMENTS } from '../constants/presets.js'

const NAME_DEBOUNCE_MS = 300

// 跨标签页广播频道；本页标识用于忽略自身消息（BroadcastChannel 本不回送自身，此处为双保险）。
const SYNC_CHANNEL_NAME = 'markview-docs-sync'
const TAB_ID =
    (typeof crypto !== 'undefined' && crypto.randomUUID && crypto.randomUUID()) ||
    `${Date.now()}-${Math.random().toString(36).slice(2)}`

const SAVE_STATUS_LABEL = {
    [SAVE_STATUS.SAVED]: '已自动保存',
    [SAVE_STATUS.UNSAVED]: '未保存',
    [SAVE_STATUS.SAVING]: '保存中',
    [SAVE_STATUS.FAILED]: '保存失败',
    [SAVE_STATUS.MEMORY_ONLY]: '仅内存保存'
}

// 文档响应式会话：多文档 CRUD、活动文档、自动派生文件名、持久化编排。
// 纯逻辑（模型/存储/调度）已下沉到 core，这里只做响应式状态与时序编排。
// onExternalUpdate：另一标签页写入被本页协调后回调，让上层把变更推回编辑器。
export const createDocumentSession = ({ onExternalUpdate } = {}) => {
    let canPersist = isIndexedDbSupported()
    const state = ref({ activeId: '', files: [] })
    const isReady = ref(false)
    const saveStatus = ref(canPersist ? SAVE_STATUS.SAVED : SAVE_STATUS.MEMORY_ONLY)

    let nameTimer = null
    let syncChannel = null
    let reconciling = false
    let pendingReconcile = false

    const files = computed(() => state.value.files)
    const activeFileId = computed(() => state.value.activeId)
    const activeFile = computed(() => files.value.find((file) => file.id === activeFileId.value) || files.value[0])
    const content = computed(() => activeFile.value?.content || '')
    const saveStatusLabel = computed(() => SAVE_STATUS_LABEL[saveStatus.value] || saveStatus.value)
    const stats = computed(() => {
        // 行数按原文算（base64 是单行，剔除不影响行数）；字数 / 字符基于剔除图片数据后的可读文本。
        const readable = stripImageData(content.value)
        return {
            lines: content.value ? content.value.split('\n').length : 0,
            words: countWords(readable),
            chars: readable.length,
            images: countImages(content.value)
        }
    })

    const scheduler = createPersistenceScheduler({
        getSnapshot: () => snapshotState(state.value),
        save: saveDocumentState,
        canPersist,
        onStatus: (status) => {
            saveStatus.value = status
            // 落盘成功即通知其他标签页协调（自身不接收此消息）。
            if (status === SAVE_STATUS.SAVED) notifyOtherTabs()
        }
    })

    // —— 多标签页同步 ——
    const notifyOtherTabs = () => {
        if (syncChannel) syncChannel.postMessage({ tabId: TAB_ID })
    }

    // 从 IndexedDB 重载并与本页内存状态协调；loadDocumentState 同时把 lastPersisted 校准到 DB 真相。
    const reconcileFromStore = async () => {
        if (!canPersist || reconciling) return
        reconciling = true
        try {
            const incoming = await loadDocumentState()
            if (!incoming) return // DB 被清空：保留本页内存，不覆盖
            const normalized = normalizeState(incoming, PRESET_DOCUMENTS)
            const { state: nextState, activeContent, forgetIds } = reconcileDocumentState({
                current: state.value,
                incoming: normalized,
                hasLocalPending: scheduler.hasPending()
            })
            state.value = nextState
            onExternalUpdate?.({ activeContent, forgetIds })
        } catch (error) {
            console.warn('多标签页状态协调失败:', error)
        } finally {
            reconciling = false
        }
    }

    const handleVisibilityForSync = () => {
        if (document.visibilityState === 'visible' && pendingReconcile) {
            pendingReconcile = false
            reconcileFromStore()
        }
    }

    const startSync = () => {
        if (!canPersist || typeof BroadcastChannel === 'undefined' || typeof document === 'undefined') return
        syncChannel = new BroadcastChannel(SYNC_CHANNEL_NAME)
        syncChannel.onmessage = (event) => {
            if (event.data?.tabId === TAB_ID) return
            // 可见时立即协调；后台标签页先标记，回到前台再协调，避免隐藏页无谓渲染。
            if (document.visibilityState === 'visible') reconcileFromStore()
            else pendingReconcile = true
        }
        document.addEventListener('visibilitychange', handleVisibilityForSync)
    }

    const stopSync = () => {
        if (syncChannel) {
            syncChannel.close()
            syncChannel = null
        }
        if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', handleVisibilityForSync)
    }

    // —— 文件名派生 ——
    const applyDerivedName = (fileId) => {
        const file = files.value.find((item) => item.id === fileId)
        if (!file) return false

        const nextName = createUniqueName(
            files.value.filter((item) => item.id !== file.id),
            deriveDocumentName(file.content)
        )
        if (file.name === nextName) return false

        file.name = nextName
        file.updatedAt = Date.now()
        return true
    }

    const flushDocumentName = (fileId = activeFileId.value) => {
        clearTimeout(nameTimer)
        nameTimer = null
        return applyDerivedName(fileId)
    }

    const scheduleDocumentNameUpdate = (fileId) => {
        clearTimeout(nameTimer)
        nameTimer = setTimeout(() => {
            nameTimer = null
            if (applyDerivedName(fileId)) scheduler.schedule()
        }, NAME_DEBOUNCE_MS)
    }

    // 切换/新建/删除前：先落盘当前文档，再执行操作并立即保存新状态。
    const commitBeforeSwitch = () => {
        flushDocumentName()
        scheduler.flush({ markDirty: false })
    }

    // —— 对外动作 ——
    const setContent = (text) => {
        const file = activeFile.value
        if (!file || file.content === text) return

        file.content = text
        file.updatedAt = Date.now()
        scheduleDocumentNameUpdate(file.id)
        scheduler.schedule()
    }

    const select = (id) => {
        if (!files.value.some((file) => file.id === id) || state.value.activeId === id) return

        commitBeforeSwitch()
        state.value.activeId = id
        scheduler.schedule({ delay: 0 })
    }

    const create = () => {
        commitBeforeSwitch()

        const file = createDocument('')
        file.name = createUniqueName(files.value, file.name)
        state.value.files.unshift(file) // 新建文档排在最前
        state.value.activeId = file.id
        scheduler.schedule({ delay: 0 })
    }

    const importFile = ({ content: fileContent = '' } = {}) => {
        commitBeforeSwitch()

        const file = createDocument(String(fileContent || ''))
        file.name = createUniqueName(files.value, file.name)
        state.value.files.unshift(file)
        state.value.activeId = file.id
        scheduler.schedule({ delay: 0 })
    }

    const remove = (id) => {
        const index = state.value.files.findIndex((file) => file.id === id)
        if (index === -1) return

        commitBeforeSwitch()
        state.value.files.splice(index, 1)

        if (!state.value.files.length) {
            const file = createDocument('')
            state.value.files.push(file)
            state.value.activeId = file.id
            scheduler.schedule({ delay: 0 })
            return
        }

        if (state.value.activeId === id) {
            const nextFile = state.value.files[Math.min(index, state.value.files.length - 1)]
            state.value.activeId = nextFile.id
        }
        scheduler.schedule({ delay: 0 })
    }

    const clearContent = () => setContent('')

    // —— 生命周期 ——
    const hydrate = async () => {
        let nextState
        let needsInitialWrite = false

        if (canPersist) {
            try {
                const savedState = await loadDocumentState()
                if (savedState) {
                    nextState = normalizeState(savedState, PRESET_DOCUMENTS)
                } else {
                    nextState = createInitialState(PRESET_DOCUMENTS)
                    needsInitialWrite = true
                }
            } catch (error) {
                console.warn('IndexedDB 加载失败，改用内存数据:', error)
                nextState = createInitialState(PRESET_DOCUMENTS)
                canPersist = false
                scheduler.setCanPersist(false)
                saveStatus.value = SAVE_STATUS.MEMORY_ONLY
            }
        } else {
            nextState = createInitialState(PRESET_DOCUMENTS)
            saveStatus.value = SAVE_STATUS.MEMORY_ONLY
        }

        state.value = nextState

        if (needsInitialWrite) {
            try {
                await saveDocumentState(snapshotState(nextState))
                saveStatus.value = SAVE_STATUS.SAVED
            } catch (error) {
                console.warn('IndexedDB 初始化写入失败:', error)
                saveStatus.value = SAVE_STATUS.FAILED
            }
        }

        scheduler.setEnabled(true)
        startSync()
        isReady.value = true
    }

    const flush = () => {
        flushDocumentName()
        return scheduler.flush({ markDirty: false })
    }

    const dispose = () => {
        flush()
        clearTimeout(nameTimer)
        scheduler.dispose()
        stopSync()
    }

    return {
        files,
        activeFile,
        activeFileId,
        content,
        saveStatus,
        saveStatusLabel,
        stats,
        isReady,
        select,
        create,
        importFile,
        remove,
        setContent,
        clearContent,
        hydrate,
        flush,
        dispose
    }
}

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
import { countWords } from '../core/text.js'
import { PRESET_DOCUMENTS } from '../constants/presets.js'

const NAME_DEBOUNCE_MS = 300

const SAVE_STATUS_LABEL = {
    [SAVE_STATUS.SAVED]: '已自动保存',
    [SAVE_STATUS.UNSAVED]: '未保存',
    [SAVE_STATUS.SAVING]: '保存中',
    [SAVE_STATUS.FAILED]: '保存失败',
    [SAVE_STATUS.MEMORY_ONLY]: '仅内存保存'
}

// 文档响应式会话：多文档 CRUD、活动文档、自动派生文件名、持久化编排。
// 纯逻辑（模型/存储/调度）已下沉到 core，这里只做响应式状态与时序编排。
export const createDocumentSession = () => {
    let canPersist = isIndexedDbSupported()
    const state = ref({ activeId: '', files: [] })
    const isReady = ref(false)
    const saveStatus = ref(canPersist ? SAVE_STATUS.SAVED : SAVE_STATUS.MEMORY_ONLY)

    let nameTimer = null

    const files = computed(() => state.value.files)
    const activeFileId = computed(() => state.value.activeId)
    const activeFile = computed(() => files.value.find((file) => file.id === activeFileId.value) || files.value[0])
    const content = computed(() => activeFile.value?.content || '')
    const saveStatusLabel = computed(() => SAVE_STATUS_LABEL[saveStatus.value] || saveStatus.value)
    const stats = computed(() => ({
        lines: content.value ? content.value.split('\n').length : 0,
        words: countWords(content.value),
        chars: content.value.length
    }))

    const scheduler = createPersistenceScheduler({
        getSnapshot: () => snapshotState(state.value),
        save: saveDocumentState,
        canPersist,
        onStatus: (status) => {
            saveStatus.value = status
        }
    })

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

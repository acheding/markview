import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { DEFAULT_DOCUMENT_NAME, PRESET_DOCUMENTS } from '../constants/editor'
import { isIndexedDbSupported, loadDocumentState, saveDocumentState } from '../utils/documentStore'

const SAVE_DEBOUNCE_MS = 800
const NAME_DEBOUNCE_MS = 300
const SAVE_STATUS = {
    SAVED: '已自动保存',
    UNSAVED: '未保存',
    SAVING: '保存中',
    FAILED: '保存失败',
    MEMORY_ONLY: '仅内存保存'
}

const createId = () => `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

const stripMarkdownTitle = (value) =>
    value
        .replace(/[`*_~[\]()#]/g, '')
        .replace(/\s+/g, ' ')
        .trim()

const stripMarkdownText = (value) =>
    value
        .replace(/^>\s*/g, '')
        .replace(/^[-*+]\s+/g, '')
        .replace(/^\d+[.)]\s+/g, '')
        .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/[`*_~[\]()#|]/g, '')
        .replace(/\s+/g, ' ')
        .trim()

const normalizeFileName = (value) => {
    const safeName = value
        .replace(/[\\/:*?"<>|]/g, '-')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 80)

    return safeName ? `${safeName}.md` : DEFAULT_DOCUMENT_NAME
}

const normalizeImportedFileName = (value, content) => {
    const rawName = String(value || '')
        .split(/[\\/]/)
        .pop()
    const safeName = rawName
        .replace(/[\\/:*?"<>|]/g, '-')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 80)

    if (!safeName) return deriveDocumentName(content)

    return /\.(md|markdown)$/i.test(safeName) ? safeName : `${safeName}.md`
}

const deriveDocumentName = (content) => {
    const headings = Array.from(content.matchAll(/^(#{1,6})\s+(.+?)\s*#*\s*$/gm))
        .map((match) => ({
            level: match[1].length,
            title: stripMarkdownTitle(match[2])
        }))
        .filter((heading) => heading.title)

    for (let level = 1; level <= 6; level += 1) {
        const heading = headings.find((item) => item.level === level)
        if (heading) return normalizeFileName(heading.title)
    }

    const contentTitle = content
        .split('\n')
        .map((line) => stripMarkdownText(line))
        .find((line) => line && !/^[-=]{3,}$/.test(line))

    if (contentTitle) return normalizeFileName(contentTitle)

    return DEFAULT_DOCUMENT_NAME
}

const createDocument = (content = '', name = '') => ({
    id: createId(),
    name: name || deriveDocumentName(content),
    content,
    updatedAt: Date.now()
})

const createUniqueName = (files, baseName) => {
    const names = new Set(files.map((file) => file.name))
    if (!names.has(baseName)) return baseName

    const dotIndex = baseName.lastIndexOf('.')
    const stem = dotIndex > 0 ? baseName.slice(0, dotIndex) : baseName
    const ext = dotIndex > 0 ? baseName.slice(dotIndex) : ''
    let index = 2

    while (names.has(`${stem} ${index}${ext}`)) {
        index += 1
    }

    return `${stem} ${index}${ext}`
}

const createInitialState = () => {
    const files = []

    PRESET_DOCUMENTS.forEach((preset) => {
        const presetFile = createDocument(preset.content, preset.name)
        presetFile.name = createUniqueName(files, presetFile.name)
        files.push(presetFile)
    })

    // 兜底：极端情况下（无预置且无旧内容）至少保留一个空文档。
    if (!files.length) {
        files.push(createDocument(''))
    }

    return {
        activeId: files[0].id,
        files
    }
}

const normalizeState = (state) => {
    if (!state || !Array.isArray(state.files) || state.files.length === 0) {
        return createInitialState()
    }

    const files = []

    state.files
        .filter((file) => file && typeof file.id === 'string')
        .forEach((file) => {
            const content = String(file.content || '')
            files.push({
                id: file.id,
                name: createUniqueName(files, normalizeImportedFileName(file.name, content)),
                content,
                updatedAt: Number(file.updatedAt || Date.now())
            })
        })

    if (!files.length) return createInitialState()

    const activeId = files.some((file) => file.id === state.activeId) ? state.activeId : files[0].id

    return {
        activeId,
        files
    }
}

const snapshotState = (state) => ({
    activeId: state.activeId,
    files: state.files.map((file) => ({
        id: file.id,
        name: file.name,
        content: file.content,
        updatedAt: file.updatedAt
    }))
})

export const useMarkdownDocuments = () => {
    let canPersist = isIndexedDbSupported()
    const saveStatus = ref(canPersist ? SAVE_STATUS.SAVED : SAVE_STATUS.MEMORY_ONLY)
    const isReady = ref(false)
    const state = ref({ activeId: '', files: [] })
    let saveTimer = null
    let nameTimer = null
    let saveChain = Promise.resolve()
    let saveRevision = 0
    let hasPendingSave = false

    const files = computed(() => state.value.files)
    const activeFileId = computed(() => state.value.activeId)
    const activeFile = computed(() => files.value.find((file) => file.id === activeFileId.value) || files.value[0])

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

    const setPendingStatus = () => {
        saveStatus.value = canPersist ? SAVE_STATUS.UNSAVED : SAVE_STATUS.MEMORY_ONLY
    }

    const enqueueSave = (snapshot, revision) => {
        saveChain = saveChain
            .catch(() => {})
            .then(async () => {
                if (!canPersist) {
                    saveStatus.value = SAVE_STATUS.MEMORY_ONLY
                    return
                }

                saveStatus.value = SAVE_STATUS.SAVING

                try {
                    await saveDocumentState(snapshot)
                    if (saveRevision === revision) {
                        hasPendingSave = false
                        saveStatus.value = SAVE_STATUS.SAVED
                    }
                } catch (error) {
                    saveStatus.value = SAVE_STATUS.FAILED
                    console.warn('IndexedDB 写入失败:', error)
                }
            })

        return saveChain
    }

    const scheduleSave = ({ delay = SAVE_DEBOUNCE_MS } = {}) => {
        if (!isReady.value) return

        hasPendingSave = true
        saveRevision += 1
        setPendingStatus()
        clearTimeout(saveTimer)

        saveTimer = setTimeout(() => {
            saveTimer = null
            enqueueSave(snapshotState(state.value), saveRevision)
        }, delay)
    }

    const flushSave = ({ includeName = true } = {}) => {
        const nameChanged = includeName ? flushDocumentName() : false

        if (nameChanged && isReady.value) {
            hasPendingSave = true
            saveRevision += 1
            setPendingStatus()
        }

        clearTimeout(saveTimer)
        saveTimer = null

        if (!isReady.value || !hasPendingSave) return saveChain

        return enqueueSave(snapshotState(state.value), saveRevision)
    }

    const scheduleDocumentNameUpdate = (fileId) => {
        clearTimeout(nameTimer)
        nameTimer = setTimeout(() => {
            nameTimer = null
            if (applyDerivedName(fileId)) {
                scheduleSave()
            }
        }, NAME_DEBOUNCE_MS)
    }

    const markdownContent = computed({
        get: () => activeFile.value?.content || '',
        set: (content) => {
            const file = activeFile.value
            if (!file) return
            if (file.content === content) return

            file.content = content
            file.updatedAt = Date.now()
            scheduleDocumentNameUpdate(file.id)
            scheduleSave()
        }
    })

    const selectFile = (id) => {
        if (!files.value.some((file) => file.id === id) || state.value.activeId === id) return

        flushDocumentName()
        flushSave({ includeName: false })
        state.value.activeId = id
        scheduleSave({ delay: 0 })
    }

    const createFile = () => {
        flushDocumentName()
        flushSave({ includeName: false })

        const file = createDocument('')
        file.name = createUniqueName(files.value, file.name)
        // 新建文档按时间倒序排在最前。
        state.value.files.unshift(file)
        state.value.activeId = file.id
        scheduleSave({ delay: 0 })
    }

    const importFile = ({ name = '', content = '' } = {}) => {
        flushDocumentName()
        flushSave({ includeName: false })

        const file = createDocument(String(content || ''))
        file.name = createUniqueName(files.value, normalizeImportedFileName(name, file.content))
        // 导入文档按时间倒序排在最前。
        state.value.files.unshift(file)
        state.value.activeId = file.id
        scheduleSave({ delay: 0 })
    }

    const deleteFile = (id) => {
        const index = state.value.files.findIndex((file) => file.id === id)
        if (index === -1) return

        flushDocumentName()
        flushSave({ includeName: false })
        state.value.files.splice(index, 1)

        if (!state.value.files.length) {
            const file = createDocument('')
            state.value.files.push(file)
            state.value.activeId = file.id
            scheduleSave({ delay: 0 })
            return
        }

        if (state.value.activeId === id) {
            const nextFile = state.value.files[Math.min(index, state.value.files.length - 1)]
            state.value.activeId = nextFile.id
        }

        scheduleSave({ delay: 0 })
    }

    // 首次加载：优先读取 IndexedDB；为空时生成预置文档并写入。
    const hydrate = async () => {
        let nextState
        let needsInitialWrite = false

        if (canPersist) {
            try {
                const savedState = await loadDocumentState()
                if (savedState) {
                    nextState = normalizeState(savedState)
                } else {
                    nextState = createInitialState()
                    needsInitialWrite = true
                }
            } catch (error) {
                console.warn('IndexedDB 加载失败，改用内存数据:', error)
                nextState = createInitialState()
                canPersist = false
                saveStatus.value = SAVE_STATUS.MEMORY_ONLY
            }
        } else {
            nextState = createInitialState()
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

        await nextTick()
        isReady.value = true
    }

    const flushBeforePageLeaves = () => {
        flushSave()
    }

    const flushWhenHidden = () => {
        if (document.visibilityState === 'hidden') {
            flushSave()
        }
    }

    onMounted(() => {
        window.addEventListener('pagehide', flushBeforePageLeaves)
        window.addEventListener('beforeunload', flushBeforePageLeaves)
        document.addEventListener('visibilitychange', flushWhenHidden)
    })

    onBeforeUnmount(() => {
        flushSave()
        clearTimeout(saveTimer)
        clearTimeout(nameTimer)
        window.removeEventListener('pagehide', flushBeforePageLeaves)
        window.removeEventListener('beforeunload', flushBeforePageLeaves)
        document.removeEventListener('visibilitychange', flushWhenHidden)
    })

    hydrate()

    return {
        files,
        activeFile,
        activeFileId,
        markdownContent,
        saveStatus,
        isReady,
        selectFile,
        createFile,
        importFile,
        deleteFile
    }
}

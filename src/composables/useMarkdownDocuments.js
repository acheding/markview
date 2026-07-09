import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import {
    DEFAULT_DOCUMENT_NAME,
    PRESET_DOCUMENTS,
} from '../constants/editor'
import {
    isIndexedDbSupported,
    loadDocumentState,
    saveDocumentState,
} from '../utils/documentStore'

const createId = () => `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

const stripMarkdownTitle = (value) => value
    .replace(/[`*_~[\]()#]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

const stripMarkdownText = (value) => value
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
    const rawName = String(value || '').split(/[\\/]/).pop()
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
            title: stripMarkdownTitle(match[2]),
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
    updatedAt: Date.now(),
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
        files,
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
                updatedAt: Number(file.updatedAt || Date.now()),
            })
        })

    if (!files.length) return createInitialState()

    const activeId = files.some((file) => file.id === state.activeId)
        ? state.activeId
        : files[0].id

    return {
        activeId,
        files,
    }
}

const snapshotState = (state) => ({
    activeId: state.activeId,
    files: state.files.map((file) => ({
        id: file.id,
        name: file.name,
        content: file.content,
        updatedAt: file.updatedAt,
    })),
})

export const useMarkdownDocuments = () => {
    const saveStatus = ref('已自动保存')
    const isReady = ref(false)
    const state = ref({ activeId: '', files: [] })
    let saveTimer = null
    let canPersist = isIndexedDbSupported()

    const files = computed(() => state.value.files)
    const activeFileId = computed(() => state.value.activeId)
    const activeFile = computed(() => (
        files.value.find((file) => file.id === activeFileId.value) || files.value[0]
    ))

    const markdownContent = computed({
        get: () => activeFile.value?.content || '',
        set: (content) => {
            const file = activeFile.value
            if (!file) return

            file.content = content
            file.name = createUniqueName(
                files.value.filter((item) => item.id !== file.id),
                deriveDocumentName(content),
            )
            file.updatedAt = Date.now()
        },
    })

    const selectFile = (id) => {
        if (files.value.some((file) => file.id === id)) {
            state.value.activeId = id
        }
    }

    const createFile = () => {
        const file = createDocument('')
        file.name = createUniqueName(files.value, file.name)
        // 新建文档按时间倒序排在最前。
        state.value.files.unshift(file)
        state.value.activeId = file.id
    }

    const importFile = ({ name = '', content = '' } = {}) => {
        const file = createDocument(String(content || ''))
        file.name = createUniqueName(
            files.value,
            normalizeImportedFileName(name, file.content),
        )
        // 导入文档按时间倒序排在最前。
        state.value.files.unshift(file)
        state.value.activeId = file.id
    }

    const deleteFile = (id) => {
        const index = state.value.files.findIndex((file) => file.id === id)
        if (index === -1) return

        state.value.files.splice(index, 1)

        if (!state.value.files.length) {
            const file = createDocument('')
            state.value.files.push(file)
            state.value.activeId = file.id
            return
        }

        if (state.value.activeId === id) {
            const nextFile = state.value.files[Math.min(index, state.value.files.length - 1)]
            state.value.activeId = nextFile.id
        }
    }

    const persist = async (snapshot) => {
        if (!canPersist) {
            saveStatus.value = '保存失败'
            return
        }

        await saveDocumentState(snapshot)
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
                saveStatus.value = '保存失败'
            }
        } else {
            nextState = createInitialState()
            saveStatus.value = '保存失败'
        }

        state.value = nextState

        if (needsInitialWrite) {
            try {
                await saveDocumentState(snapshotState(nextState))
            } catch (error) {
                console.warn('IndexedDB 初始化写入失败:', error)
                saveStatus.value = '保存失败'
            }
        }

        await nextTick()
        isReady.value = true
    }

    watch(state, () => {
        if (!isReady.value) return

        saveStatus.value = '保存中'
        clearTimeout(saveTimer)

        saveTimer = setTimeout(async () => {
            try {
                await persist(snapshotState(state.value))
                saveStatus.value = '已自动保存'
            } catch (error) {
                saveStatus.value = '保存失败'
                console.warn('IndexedDB 写入失败:', error)
            }
        }, 800)
    }, { deep: true })

    onBeforeUnmount(() => {
        clearTimeout(saveTimer)
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
        deleteFile,
    }
}

import { computed, onBeforeUnmount, ref, watch } from 'vue'
import {
    DEFAULT_DOCUMENT_NAME,
    DOCUMENTS_STORAGE_KEY,
    LEGACY_STORAGE_KEY,
    PRESET_DOCUMENTS,
} from '../constants/editor'

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

    // 迁移旧版单文档存储的内容（若有），放在最前并作为激活项。
    try {
        const saved = localStorage.getItem(LEGACY_STORAGE_KEY)
        if (saved) {
            files.push(createDocument(saved))
        }
    } catch (error) {
        console.warn('旧 localStorage 内容读取失败:', error)
    }

    // 追加预置文档（欢迎 / README / 博客）。
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

const loadDocuments = () => {
    try {
        const saved = localStorage.getItem(DOCUMENTS_STORAGE_KEY)
        if (saved) {
            return normalizeState(JSON.parse(saved))
        }
    } catch (error) {
        console.warn('多文档 localStorage 读取失败:', error)
    }

    return createInitialState()
}

export const useMarkdownDocuments = () => {
    const saveStatus = ref('已自动保存')
    const state = ref(loadDocuments())
    let saveTimer = null

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

    watch(state, (nextState) => {
        saveStatus.value = '保存中'
        clearTimeout(saveTimer)

        saveTimer = setTimeout(() => {
            try {
                localStorage.setItem(DOCUMENTS_STORAGE_KEY, JSON.stringify(nextState))
                saveStatus.value = '已自动保存'
            } catch (error) {
                saveStatus.value = '保存失败'
                console.warn('多文档 localStorage 写入失败:', error)
            }
        }, 1000)
    }, { deep: true })

    onBeforeUnmount(() => {
        clearTimeout(saveTimer)
    })

    return {
        files,
        activeFile,
        activeFileId,
        markdownContent,
        saveStatus,
        selectFile,
        createFile,
        importFile,
        deleteFile,
    }
}

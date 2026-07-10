// 文档领域模型：ID 生成、文件名派生/清洗/去重、状态归一化。
// 全部为纯函数，预置文档以参数注入，便于单测。

export const DEFAULT_DOCUMENT_NAME = '新文档.md'

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

export const normalizeFileName = (value) => {
    const safeName = value
        .replace(/[\\/:*?"<>|]/g, '-')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 80)

    return safeName ? `${safeName}.md` : DEFAULT_DOCUMENT_NAME
}

export const normalizeImportedFileName = (value, content) => {
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

// 导出用文件名：清洗非法字符，保证 .md 扩展名。
export const getExportFileName = (name) => {
    const safeName = String(name || '')
        .replace(/[\\/:*?"<>|]/g, '-')
        .replace(/\s+/g, ' ')
        .trim()

    if (!safeName) return 'document.md'

    return /\.(md|markdown)$/i.test(safeName) ? safeName : `${safeName}.md`
}

// 从内容首个标题（h1→h6 优先级）或首行正文派生文件名。
export const deriveDocumentName = (content) => {
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

export const createDocument = (content = '', name = '') => ({
    id: createId(),
    name: name || deriveDocumentName(content),
    content,
    updatedAt: Date.now()
})

export const createUniqueName = (files, baseName) => {
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

export const createInitialState = (presets = []) => {
    const files = []

    presets.forEach((preset) => {
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

export const normalizeState = (state, presets = []) => {
    if (!state || !Array.isArray(state.files) || state.files.length === 0) {
        return createInitialState(presets)
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

    if (!files.length) return createInitialState(presets)

    const activeId = files.some((file) => file.id === state.activeId) ? state.activeId : files[0].id

    return {
        activeId,
        files
    }
}

export const snapshotState = (state) => ({
    activeId: state.activeId,
    files: state.files.map((file) => ({
        id: file.id,
        name: file.name,
        content: file.content,
        updatedAt: file.updatedAt
    }))
})

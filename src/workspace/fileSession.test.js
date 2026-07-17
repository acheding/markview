import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, ref } from 'vue'
import { FILE_LINK_STATUS, createFileSession } from './fileSession.js'
import {
    deleteFileHandles,
    isIndexedDbSupported,
    loadFileHandles,
    saveFileHandle
} from '../core/documents/documentStore.js'

// documentStore 全量 mock：句柄持久化只验证调用契约，不落真 IndexedDB。
vi.mock('../core/documents/documentStore.js', () => ({
    isIndexedDbSupported: vi.fn(() => true),
    loadFileHandles: vi.fn(async () => new Map()),
    saveFileHandle: vi.fn(async () => {}),
    deleteFileHandles: vi.fn(async () => {})
}))

// —— 假句柄：内建磁盘状态（内容 / mtime / 权限），行为与 FileSystemFileHandle 对齐 ——
const makeHandle = (name, { content = '', lastModified = 1, permission = 'granted', writable = true } = {}) => {
    const diskState = { name, content, lastModified, permission }
    const handle = {
        kind: 'file',
        diskState,
        get name() {
            return diskState.name
        },
        queryPermission: vi.fn(async () => diskState.permission),
        requestPermission: vi.fn(async () => {
            diskState.permission = 'granted'
            return 'granted'
        }),
        getFile: vi.fn(async () => ({
            name: diskState.name,
            lastModified: diskState.lastModified,
            text: async () => diskState.content
        }))
    }
    if (writable) {
        handle.createWritable = vi.fn(async () => {
            let pending = ''
            return {
                write: async (data) => {
                    pending = data
                },
                close: async () => {
                    diskState.content = pending
                    diskState.lastModified += 1
                }
            }
        })
    }
    handle.isSameEntry = vi.fn(async (other) => other === handle)
    return handle
}

// —— documents 会话的最小可用替身：ref 状态 + 与真实现一致的动作语义 ——
const makeDocuments = (initialFiles = []) => {
    let seq = 0
    const files = ref(initialFiles)
    const activeFileId = ref(initialFiles[0]?.id || '')
    const activeFile = computed(() => files.value.find((file) => file.id === activeFileId.value) || files.value[0])
    const content = computed(() => activeFile.value?.content || '')

    return {
        files,
        activeFileId,
        activeFile,
        content,
        importFile: vi.fn(({ content: text = '' } = {}) => {
            seq += 1
            const id = `doc_${seq}`
            files.value = [{ id, name: '新文档.md', content: String(text).replace(/\r\n?/g, '\n') }, ...files.value]
            activeFileId.value = id
            return id
        }),
        setDocumentName: vi.fn((id, name) => {
            files.value = files.value.map((file) => (file.id === id ? { ...file, name } : file))
        }),
        flush: vi.fn(async () => {}),
        replaceContent: vi.fn((id, text) => {
            files.value = files.value.map((file) => (file.id === id ? { ...file, content: text } : file))
        }),
        select: vi.fn((id) => {
            activeFileId.value = id
        }),
        setContent(text) {
            files.value = files.value.map((file) =>
                file.id === activeFileId.value ? { ...file, content: text } : file
            )
        }
    }
}

const makeSession = ({ initialFiles = [], confirmAnswer = true } = {}) => {
    vi.stubGlobal('window', { showOpenFilePicker: vi.fn(), showSaveFilePicker: vi.fn() })
    const documents = makeDocuments(initialFiles)
    const toast = { show: vi.fn() }
    const confirm = { ask: vi.fn(async () => confirmAnswer) }
    const editor = { setDoc: vi.fn(), forgetDocument: vi.fn() }
    const session = createFileSession({ documents, toast, confirm, getEditor: () => editor })
    return { session, documents, toast, confirm, editor }
}

beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
    loadFileHandles.mockImplementation(async () => new Map())
    isIndexedDbSupported.mockImplementation(() => true)
})

describe('打开文件（openViaHandles）', () => {
    it('新文件：导入内容、文档名取磁盘名、建立关联并持久化句柄，状态为已写回', async () => {
        const { session, documents, toast } = makeSession()
        await session.init()

        const handle = makeHandle('笔记.md', { content: '# 笔记\r\n正文', lastModified: 10 })
        await session.openViaHandles([handle])

        expect(documents.importFile).toHaveBeenCalledWith({ content: '# 笔记\r\n正文' })
        expect(documents.setDocumentName).toHaveBeenCalledWith('doc_1', '笔记.md')
        expect(session.isLinked('doc_1')).toBe(true)
        expect(saveFileHandle).toHaveBeenCalledWith('doc_1', handle)
        // 签名基于行尾归一化后的内容：打开后即为「已写回」而非「未写回」
        expect(session.activeStatus.value).toBe(FILE_LINK_STATUS.SYNCED)
        expect(toast.show).toHaveBeenCalledWith('已打开文件', { tone: 'success' })
    })

    it('同一磁盘文件再次打开：不导入副本，切换到既有文档', async () => {
        const { session, documents, toast } = makeSession()
        await session.init()

        const handle = makeHandle('a.md', { content: '# A' })
        await session.openViaHandles([handle])
        documents.select('missing-switch-away')
        toast.show.mockClear()

        await session.openViaHandles([handle])

        expect(documents.importFile).toHaveBeenCalledTimes(1)
        expect(documents.select).toHaveBeenLastCalledWith('doc_1')
        expect(toast.show).toHaveBeenCalledWith('文件已打开，已切换到对应文档', { tone: 'success' })
    })

    // 命名不去重依赖「关联即锁名」：若先命名后关联，锁定尚未生效，磁盘名会被误加序号。
    it('建立关联先于命名：setDocumentName 调用时文档已处于关联态', async () => {
        const { session, documents } = makeSession()
        await session.init()

        let linkedAtNaming = null
        documents.setDocumentName.mockImplementation((id) => {
            linkedAtNaming = session.isLinked(id)
        })
        await session.openViaHandles([makeHandle('a.md', { content: '# A' })])

        expect(linkedAtNaming).toBe(true)
    })

    it('只读句柄：导入副本但不建立关联', async () => {
        const { session } = makeSession()
        await session.init()

        await session.openViaHandles([makeHandle('r.md', { content: '# R', writable: false })])

        expect(session.isLinked('doc_1')).toBe(false)
        expect(saveFileHandle).not.toHaveBeenCalled()
    })
})

describe('写回（saveActiveToFile）', () => {
    it('编辑后未写回 → Ctrl+S 把当前内容写入磁盘并回到已写回态', async () => {
        const { session, documents, toast } = makeSession()
        await session.init()
        const handle = makeHandle('a.md', { content: '# 旧', lastModified: 5 })
        await session.openViaHandles([handle])

        documents.setContent('# 新内容')
        expect(session.activeStatus.value).toBe(FILE_LINK_STATUS.DIRTY)

        const outcome = await session.saveActiveToFile()

        expect(outcome).toBe('saved')
        expect(handle.diskState.content).toBe('# 新内容')
        expect(session.activeStatus.value).toBe(FILE_LINK_STATUS.SYNCED)
        expect(toast.show).toHaveBeenCalledWith('已写回 a.md', { tone: 'success' })
    })

    it('磁盘在别处被修改：确认取消则不写入', async () => {
        const { session, documents, confirm } = makeSession({ confirmAnswer: false })
        await session.init()
        const handle = makeHandle('a.md', { content: '# 原始', lastModified: 5 })
        await session.openViaHandles([handle])

        documents.setContent('# 本地编辑')
        handle.diskState.content = '# 外部编辑'
        handle.diskState.lastModified = 99

        const outcome = await session.saveActiveToFile()

        expect(confirm.ask).toHaveBeenCalledTimes(1)
        expect(outcome).toBe('canceled')
        expect(handle.diskState.content).toBe('# 外部编辑')
        expect(handle.createWritable).not.toHaveBeenCalled()
    })

    it('无关联文档返回 no-link，由调用方走旧的保存提示', async () => {
        const { session } = makeSession({ initialFiles: [{ id: 'doc_x', name: 'x.md', content: '' }] })
        await session.init()
        await expect(session.saveActiveToFile()).resolves.toBe('no-link')
    })
})

describe('跨会话恢复与权限', () => {
    it('恢复的句柄权限为 prompt：状态为待授权，Ctrl+S 在手势内请求权限后完成写回', async () => {
        const handle = makeHandle('a.md', { content: '# 磁盘', lastModified: 3, permission: 'prompt' })
        loadFileHandles.mockImplementation(async () => new Map([['doc_a', handle]]))
        const { session, documents } = makeSession({
            initialFiles: [{ id: 'doc_a', name: 'a.md', content: '# 磁盘' }]
        })

        await session.init()
        expect(session.activeStatus.value).toBe(FILE_LINK_STATUS.PERMISSION)

        documents.setContent('# 编辑过')
        const outcome = await session.saveActiveToFile()

        expect(handle.requestPermission).toHaveBeenCalled()
        expect(outcome).toBe('saved')
        expect(handle.diskState.content).toBe('# 编辑过')
        expect(session.activeStatus.value).toBe(FILE_LINK_STATUS.SYNCED)
    })

    it('孤儿句柄（文档已不存在）在启动时被清理', async () => {
        loadFileHandles.mockImplementation(async () => new Map([['ghost', makeHandle('g.md')]]))
        const { session } = makeSession({ initialFiles: [{ id: 'doc_a', name: 'a.md', content: '' }] })
        await session.init()
        expect(deleteFileHandles).toHaveBeenCalledWith(['ghost'])
        expect(session.isLinked('ghost')).toBe(false)
    })
})

describe('外部修改检测（checkActiveExternal）', () => {
    it('本地无未写回编辑：自动重载磁盘最新内容并推回编辑器', async () => {
        const { session, documents, editor, toast } = makeSession()
        await session.init()
        const handle = makeHandle('a.md', { content: '# v1', lastModified: 1 })
        await session.openViaHandles([handle])

        handle.diskState.content = '# v2'
        handle.diskState.lastModified = 2
        await session.checkActiveExternal()

        expect(documents.replaceContent).toHaveBeenCalledWith('doc_1', '# v2')
        expect(editor.setDoc).toHaveBeenCalledWith('# v2')
        expect(toast.show).toHaveBeenCalledWith('已加载「a.md」的最新内容', { tone: 'success' })
        expect(session.activeStatus.value).toBe(FILE_LINK_STATUS.SYNCED)
    })

    it('双方都有修改：弹确认；选择保留本地后对齐基线，不再重复弹窗', async () => {
        const { session, documents, confirm } = makeSession({ confirmAnswer: false })
        await session.init()
        const handle = makeHandle('a.md', { content: '# v1', lastModified: 1 })
        await session.openViaHandles([handle])

        documents.setContent('# 本地版')
        handle.diskState.content = '# 磁盘版'
        handle.diskState.lastModified = 2

        await session.checkActiveExternal()
        expect(confirm.ask).toHaveBeenCalledTimes(1)
        expect(documents.replaceContent).not.toHaveBeenCalled()
        expect(session.activeStatus.value).toBe(FILE_LINK_STATUS.DIRTY)

        // 基线已对齐（mtime 已知悉）：再次核对不弹窗
        await session.checkActiveExternal()
        expect(confirm.ask).toHaveBeenCalledTimes(1)
    })

    it('磁盘文件被移动或删除：弹窗选择仅保留在 MarkView 后保存工作副本并取消关联', async () => {
        const { session, documents, toast, confirm } = makeSession({ confirmAnswer: false })
        await session.init()
        const handle = makeHandle('a.md', { content: '# v1', lastModified: 1 })
        await session.openViaHandles([handle])

        handle.getFile.mockImplementation(async () => {
            throw Object.assign(new Error('gone'), { name: 'NotFoundError' })
        })
        await session.checkActiveExternal()

        expect(confirm.ask).toHaveBeenCalledWith({
            title: '本地文件已丢失',
            message: expect.stringContaining('文件可能已被移动、重命名或删除'),
            confirmLabel: '另存为本地文件',
            cancelLabel: '仅保留在 MarkView'
        })
        expect(documents.flush).toHaveBeenCalledTimes(1)
        expect(deleteFileHandles).toHaveBeenCalledWith(['doc_1'])
        expect(session.isLinked('doc_1')).toBe(false)
        expect(session.activeStatus.value).toBeNull()
        expect(toast.show).toHaveBeenCalledWith('已取消与「a.md」的关联，文档将继续保存在 MarkView 中', {
            tone: 'success',
            duration: 3200
        })
    })

    it('文件丢失弹窗选择另存为：写入新位置并恢复关联', async () => {
        const { session, documents } = makeSession()
        await session.init()
        const missingHandle = makeHandle('a.md', { content: '# 当前内容', lastModified: 1 })
        await session.openViaHandles([missingHandle])

        missingHandle.getFile.mockImplementation(async () => {
            throw Object.assign(new Error('gone'), { name: 'NotFoundError' })
        })
        const target = makeHandle('a-restored.md', { content: '', lastModified: 1 })
        window.showSaveFilePicker.mockImplementation(async () => target)

        await session.checkActiveExternal()

        expect(target.diskState.content).toBe('# 当前内容')
        expect(documents.setDocumentName).toHaveBeenCalledWith('doc_1', 'a-restored.md')
        expect(session.activeStatus.value).toBe(FILE_LINK_STATUS.SYNCED)
    })

    // Esc / 点遮罩关闭弹窗（confirm.ask 返回 null）＝未做选择：不得视同「仅保留在 MarkView」而静默取消关联。
    it('文件丢失弹窗被 Esc 关闭：保留失效关联与丢失标记，不取消关联', async () => {
        const { session, confirm } = makeSession({ confirmAnswer: null })
        await session.init()
        const handle = makeHandle('a.md', { content: '# v1', lastModified: 1 })
        await session.openViaHandles([handle])

        handle.getFile.mockImplementation(async () => {
            throw Object.assign(new Error('gone'), { name: 'NotFoundError' })
        })
        await session.checkActiveExternal()

        expect(confirm.ask).toHaveBeenCalledTimes(1)
        expect(session.isLinked('doc_1')).toBe(true)
        expect(deleteFileHandles).not.toHaveBeenCalled()
        expect(session.activeStatus.value).toBe(FILE_LINK_STATUS.MISSING)

        // 自动检查不重复打扰；点击头部「本地文件已丢失」标签可强制再次唤起处置弹窗
        await session.checkActiveExternal()
        expect(confirm.ask).toHaveBeenCalledTimes(1)
        await session.resolveMissingFile()
        expect(confirm.ask).toHaveBeenCalledTimes(2)
    })
})

describe('另存为（saveActiveAs）', () => {
    it('写入选择的位置、建立关联并把文档改为磁盘文件名', async () => {
        const { session, documents, toast } = makeSession({
            initialFiles: [{ id: 'doc_a', name: '草稿.md', content: '# 草稿' }]
        })
        await session.init()

        const target = makeHandle('正式.md', { content: '', lastModified: 1 })
        window.showSaveFilePicker.mockImplementation(async () => target)

        const outcome = await session.saveActiveAs()

        expect(outcome).toBe('saved')
        expect(target.diskState.content).toBe('# 草稿')
        expect(session.isLinked('doc_a')).toBe(true)
        expect(documents.setDocumentName).toHaveBeenCalledWith('doc_a', '正式.md')
        expect(saveFileHandle).toHaveBeenCalledWith('doc_a', target)
        expect(toast.show).toHaveBeenCalledWith('已保存到 正式.md', { tone: 'success' })
    })

    it('用户取消选择器：静默返回 canceled', async () => {
        const { session, toast } = makeSession({ initialFiles: [{ id: 'doc_a', name: 'a.md', content: '' }] })
        await session.init()
        window.showSaveFilePicker.mockImplementation(async () => {
            throw Object.assign(new Error('cancel'), { name: 'AbortError' })
        })
        await expect(session.saveActiveAs()).resolves.toBe('canceled')
        expect(toast.show).not.toHaveBeenCalled()
    })
})

describe('文档删除清理', () => {
    it('关联文档被删除后：内存关联与持久化句柄一并清理', async () => {
        const { session, documents } = makeSession()
        await session.init()
        await session.openViaHandles([makeHandle('a.md', { content: '# A' })])
        expect(session.isLinked('doc_1')).toBe(true)

        documents.files.value = documents.files.value.filter((file) => file.id !== 'doc_1')
        await nextTick()

        expect(session.isLinked('doc_1')).toBe(false)
        expect(deleteFileHandles).toHaveBeenCalledWith(['doc_1'])
    })
})

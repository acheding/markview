import { afterEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createImportSession } from './importSession.js'

// File 仅需 name/type/text()，用普通对象即可（类型判定见 core/documents/importableFile.js）。
const textFile = (name, content = '# 内容') => ({ name, type: '', text: async () => content })
const imageFile = (name) => ({ name, type: 'image/png' })
const binaryFile = (name) => ({ name, type: 'application/octet-stream' })
const brokenFile = (name) => ({
    name,
    type: '',
    text: async () => {
        throw new Error('read error')
    }
})

const makeSession = ({ disk } = {}) => {
    const documents = { importFile: vi.fn(), isReady: ref(true) }
    const toast = { show: vi.fn() }
    const editor = { insertImages: vi.fn() }
    const session = createImportSession({ documents, toast, getEditor: () => editor, disk })
    return { session, documents, toast, editor }
}

// importDroppedFiles 的导入分支是 fire-and-forget，等微任务清空后再断言提示。
const flushAsync = () => new Promise((resolve) => setTimeout(resolve))

describe('importFiles', () => {
    it('全部为文本文件：逐个导入并提示成功数', async () => {
        const { session, documents, toast } = makeSession()
        await session.importFiles([textFile('a.md'), textFile('b.txt')])

        expect(documents.importFile).toHaveBeenCalledTimes(2)
        expect(toast.show).toHaveBeenCalledWith('已导入 2 个文件', { tone: 'success' })
    })

    it('混入不支持格式与读取失败：合并为一条部分成功提示', async () => {
        const { session, documents, toast } = makeSession()
        vi.spyOn(console, 'warn').mockImplementation(() => {})
        await session.importFiles([textFile('a.md'), brokenFile('b.md'), binaryFile('c.bin')])

        expect(documents.importFile).toHaveBeenCalledTimes(1)
        expect(toast.show).toHaveBeenCalledWith(
            '已导入 1 个文件，2 个失败',
            expect.objectContaining({ tone: 'warning' })
        )
        vi.restoreAllMocks()
    })

    it('全部不支持：仅提示格式不支持，不触发导入', async () => {
        const { session, documents, toast } = makeSession()
        await session.importFiles([binaryFile('a.bin')])

        expect(documents.importFile).not.toHaveBeenCalled()
        expect(toast.show).toHaveBeenCalledWith(expect.stringContaining('不支持的文件格式'), expect.anything())
    })

    it('空列表：无任何副作用', async () => {
        const { session, documents, toast } = makeSession()
        await session.importFiles([])
        await session.importFiles(null)

        expect(documents.importFile).not.toHaveBeenCalled()
        expect(toast.show).not.toHaveBeenCalled()
    })
})

describe('importDroppedFiles', () => {
    it('空拖拽返回 false 放行，有文件返回 true 消费 drop', () => {
        const { session } = makeSession()
        expect(session.importDroppedFiles([])).toBe(false)
        expect(session.importDroppedFiles([textFile('a.md')])).toBe(true)
    })

    it('图片交给编辑器插入当前文档，不计入「不支持」', async () => {
        const { session, documents, toast, editor } = makeSession()
        const images = [imageFile('p.png')]
        session.importDroppedFiles(images)
        await flushAsync()

        expect(editor.insertImages).toHaveBeenCalledWith(images)
        expect(documents.importFile).not.toHaveBeenCalled()
        expect(toast.show).not.toHaveBeenCalled()
    })

    it('文本 + 不支持混投：导入文本并把不支持数并入失败提示', async () => {
        const { session, documents, toast } = makeSession()
        session.importDroppedFiles([textFile('a.md'), binaryFile('b.bin')])
        await flushAsync()

        expect(documents.importFile).toHaveBeenCalledTimes(1)
        expect(toast.show).toHaveBeenCalledWith(
            '已导入 1 个文件，1 个失败',
            expect.objectContaining({ tone: 'warning' })
        )
    })
})

describe('句柄化入口（File System Access 支持时）', () => {
    // 捕获 launchQueue consumer，模拟系统双击 .md 文件把句柄交给应用。
    const stubLaunchQueue = () => {
        let consumer = null
        vi.stubGlobal('window', {
            launchQueue: { setConsumer: (fn) => (consumer = fn) }
        })
        return () => consumer
    }

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('launchQueue：支持写回时句柄整体交给 disk（保留句柄，可写回原文件）', async () => {
        const getConsumer = stubLaunchQueue()
        const disk = { isSupported: true, openFilePicker: vi.fn(), openViaHandles: vi.fn(async () => {}) }
        const { session, documents } = makeSession({ disk })

        session.setupFileHandling()
        const handles = [{ kind: 'file', name: 'a.md' }]
        await getConsumer()({ files: handles })

        expect(disk.openViaHandles).toHaveBeenCalledWith(handles)
        expect(documents.importFile).not.toHaveBeenCalled()
    })

    it('launchQueue：不支持写回时降级为解析 File 导入副本', async () => {
        const getConsumer = stubLaunchQueue()
        const disk = { isSupported: false, openFilePicker: vi.fn(), openViaHandles: vi.fn() }
        const { session, documents, toast } = makeSession({ disk })

        session.setupFileHandling()
        await getConsumer()({
            files: [{ kind: 'file', getFile: async () => textFile('a.md') }]
        })

        expect(disk.openViaHandles).not.toHaveBeenCalled()
        expect(documents.importFile).toHaveBeenCalledTimes(1)
        expect(toast.show).toHaveBeenCalledWith('已打开文件', { tone: 'success' })
    })
})

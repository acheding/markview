import { afterEach, describe, expect, it, vi } from 'vitest'
import {
    contentSignature,
    isFileSystemAccessSupported,
    isSameFileEntry,
    isWritableFileHandle,
    pickOpenFiles,
    pickSaveFile,
    queryFilePermission,
    requestFilePermission,
    writeFileHandle
} from './fileAccess.js'

afterEach(() => {
    vi.unstubAllGlobals()
})

describe('contentSignature', () => {
    it('相同内容签名一致，不同内容签名不同', () => {
        expect(contentSignature('# 标题')).toBe(contentSignature('# 标题'))
        expect(contentSignature('# 标题')).not.toBe(contentSignature('# 标题！'))
    })

    it('签名携带长度前缀，空串与 null 归一为同一签名', () => {
        expect(contentSignature('')).toMatch(/^0:/)
        expect(contentSignature()).toBe(contentSignature(''))
    })
})

describe('能力检测', () => {
    it('window 缺失或选择器 API 不全时不支持', () => {
        expect(isFileSystemAccessSupported()).toBe(false)
        vi.stubGlobal('window', { showOpenFilePicker: () => {} })
        expect(isFileSystemAccessSupported()).toBe(false)
    })

    it('两个选择器 API 齐备时支持', () => {
        vi.stubGlobal('window', { showOpenFilePicker: () => {}, showSaveFilePicker: () => {} })
        expect(isFileSystemAccessSupported()).toBe(true)
    })

    it('isWritableFileHandle：需为 file 句柄且带 createWritable', () => {
        expect(isWritableFileHandle({ kind: 'file', createWritable: () => {} })).toBe(true)
        expect(isWritableFileHandle({ kind: 'directory', createWritable: () => {} })).toBe(false)
        expect(isWritableFileHandle({ kind: 'file' })).toBe(false)
        expect(isWritableFileHandle(null)).toBe(false)
    })
})

describe('权限', () => {
    it('实现缺失 query/requestPermission 时视为已授权', async () => {
        await expect(queryFilePermission({})).resolves.toBe('granted')
        await expect(requestFilePermission({})).resolves.toBe('granted')
    })

    it('按 readwrite 模式转发权限查询与请求', async () => {
        const handle = {
            queryPermission: vi.fn(async () => 'prompt'),
            requestPermission: vi.fn(async () => 'granted')
        }
        await expect(queryFilePermission(handle)).resolves.toBe('prompt')
        await expect(requestFilePermission(handle)).resolves.toBe('granted')
        expect(handle.queryPermission).toHaveBeenCalledWith({ mode: 'readwrite' })
        expect(handle.requestPermission).toHaveBeenCalledWith({ mode: 'readwrite' })
    })
})

describe('writeFileHandle', () => {
    it('按 write→close 顺序写入，并返回写后磁盘 mtime', async () => {
        const calls = []
        const handle = {
            createWritable: async () => ({
                write: async (data) => calls.push(['write', data]),
                close: async () => calls.push(['close'])
            }),
            getFile: async () => ({ lastModified: 42 })
        }
        const result = await writeFileHandle(handle, '# 内容')
        expect(calls).toEqual([['write', '# 内容'], ['close']])
        expect(result.lastModified).toBe(42)
    })
})

describe('选择器', () => {
    it('用户取消（AbortError）返回空结果，不抛错', async () => {
        const abort = Object.assign(new Error('canceled'), { name: 'AbortError' })
        vi.stubGlobal('window', {
            showOpenFilePicker: async () => {
                throw abort
            },
            showSaveFilePicker: async () => {
                throw abort
            }
        })
        await expect(pickOpenFiles()).resolves.toEqual([])
        await expect(pickSaveFile('a.md')).resolves.toBeNull()
    })

    it('其余异常照常抛出', async () => {
        vi.stubGlobal('window', {
            showOpenFilePicker: async () => {
                throw new Error('boom')
            }
        })
        await expect(pickOpenFiles()).rejects.toThrow('boom')
    })
})

describe('isSameFileEntry', () => {
    it('转发 isSameEntry；实现缺失或异常按不同文件处理', async () => {
        const a = { isSameEntry: vi.fn(async (other) => other === a) }
        await expect(isSameFileEntry(a, a)).resolves.toBe(true)
        await expect(isSameFileEntry(a, {})).resolves.toBe(false)
        await expect(isSameFileEntry({}, a)).resolves.toBe(false)
        const broken = {
            isSameEntry: async () => {
                throw new Error('boom')
            }
        }
        await expect(isSameFileEntry(broken, a)).resolves.toBe(false)
    })
})

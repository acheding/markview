import { describe, expect, it } from 'vitest'
import {
    DEFAULT_DOCUMENT_NAME,
    createInitialState,
    createUniqueName,
    deriveDocumentName,
    getExportFileName,
    normalizeState
} from './documentModel.js'

describe('deriveDocumentName', () => {
    it('derives the name from the top-level heading', () => {
        expect(deriveDocumentName('## 次级\n# 主标题\n正文')).toBe('主标题.md')
    })

    it('falls back to the first content line, then to the default', () => {
        expect(deriveDocumentName('- 列表项\n更多')).toBe('列表项.md')
        expect(deriveDocumentName('   \n\n')).toBe(DEFAULT_DOCUMENT_NAME)
    })
})

describe('createUniqueName', () => {
    it('appends an incrementing suffix on collision', () => {
        const files = [{ name: 'note.md' }, { name: 'note 2.md' }]
        expect(createUniqueName(files, 'note.md')).toBe('note 3.md')
        expect(createUniqueName(files, 'fresh.md')).toBe('fresh.md')
    })
})

describe('getExportFileName', () => {
    it('sanitizes and ensures the markdown extension', () => {
        expect(getExportFileName('a/b:c')).toBe('a-b-c.md')
        expect(getExportFileName('keep.markdown')).toBe('keep.markdown')
        expect(getExportFileName('')).toBe('document.md')
    })
})

describe('normalizeState', () => {
    it('creates an initial state from presets when input is empty', () => {
        const state = createInitialState([{ name: 'README.md', content: '# Hi' }])
        expect(state.files).toHaveLength(1)
        expect(state.activeId).toBe(state.files[0].id)
    })

    it('keeps valid files and repairs a dangling active id', () => {
        const state = normalizeState({
            activeId: 'missing',
            files: [{ id: 'x', name: 'x.md', content: 'hi', updatedAt: 1 }]
        })
        expect(state.activeId).toBe('x')
        expect(state.files[0].name).toBe('x.md')
    })

    // 关联本地文件的文档名与磁盘一致、允许与普通文档重名：入库数据恢复时只清洗、不强制去重，
    // 否则刷新一次就会把关联文档改成「xxx 2.md」，与磁盘文件名脱钩。
    it('preserves duplicate names on restore (linked docs may share names with plain docs)', () => {
        const state = normalizeState({
            activeId: 'a',
            files: [
                { id: 'a', name: '笔记.md', content: 'a', updatedAt: 1 },
                { id: 'b', name: '笔记.md', content: 'b', updatedAt: 2 }
            ]
        })
        expect(state.files.map((file) => file.name)).toEqual(['笔记.md', '笔记.md'])
    })
})

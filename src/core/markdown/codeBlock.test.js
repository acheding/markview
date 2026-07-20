import { describe, expect, it } from 'vitest'
import { buildCodeBlockInsertion } from './codeBlock.js'

describe('buildCodeBlockInsertion', () => {
    it('行首无选区：插入空围栏，光标停在语言标记位', () => {
        const { insert, cursorOffset } = buildCodeBlockInsertion({ selection: '', atLineStart: true })
        expect(insert).toBe('```\n\n```\n')
        expect(insert.slice(0, cursorOffset)).toBe('```')
    })

    it('光标不在行首：先断行，保证围栏独占整行', () => {
        const { insert, cursorOffset } = buildCodeBlockInsertion({ selection: '', atLineStart: false })
        expect(insert).toBe('\n```\n\n```\n')
        expect(insert.slice(0, cursorOffset)).toBe('\n```')
    })

    it('有选区：选中文本原样包进围栏，光标仍停在语言标记位', () => {
        const { insert, cursorOffset } = buildCodeBlockInsertion({ selection: 'const a = 1\n', atLineStart: true })
        expect(insert).toBe('```\nconst a = 1\n\n```\n')
        expect(insert.slice(0, cursorOffset)).toBe('```')
    })

    it('缺省参数等价于行首无选区', () => {
        expect(buildCodeBlockInsertion()).toEqual(buildCodeBlockInsertion({ selection: '', atLineStart: true }))
    })
})

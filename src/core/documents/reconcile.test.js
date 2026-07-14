import { describe, expect, it } from 'vitest'
import { reconcileDocumentState } from './reconcile.js'

const doc = (id, content, extra = {}) => ({ id, name: `${id}.md`, content, updatedAt: 1, ...extra })

describe('reconcileDocumentState', () => {
    it('空闲页采纳别处更新的活动文档内容并推回编辑器', () => {
        const result = reconcileDocumentState({
            current: { activeId: 'a', files: [doc('a', '旧'), doc('b', 'B')] },
            incoming: { activeId: 'a', files: [doc('a', '新'), doc('b', 'B')] },
            hasLocalPending: false
        })

        expect(result.state.activeId).toBe('a')
        expect(result.state.files.find((f) => f.id === 'a').content).toBe('新')
        expect(result.activeContent).toBe('新')
        expect(result.forgetIds).toEqual([])
    })

    it('本页有未落盘编辑时保留本地活动文档，不被别处覆盖', () => {
        const result = reconcileDocumentState({
            current: { activeId: 'a', files: [doc('a', '本地编辑中'), doc('b', 'B')] },
            incoming: { activeId: 'a', files: [doc('a', '别处写入'), doc('b', 'B')] },
            hasLocalPending: true
        })

        expect(result.state.files.find((f) => f.id === 'a').content).toBe('本地编辑中')
        expect(result.activeContent).toBeNull()
        expect(result.forgetIds).toEqual([])
    })

    it('非活动文档内容被外部更新时要求编辑器丢弃其缓存态', () => {
        const result = reconcileDocumentState({
            current: { activeId: 'a', files: [doc('a', 'A'), doc('b', '旧B')] },
            incoming: { activeId: 'a', files: [doc('a', 'A'), doc('b', '新B')] },
            hasLocalPending: false
        })

        expect(result.state.files.find((f) => f.id === 'b').content).toBe('新B')
        expect(result.activeContent).toBeNull()
        expect(result.forgetIds).toEqual(['b'])
    })

    it('别处新建的文档并入本页且无需推回编辑器', () => {
        const result = reconcileDocumentState({
            current: { activeId: 'a', files: [doc('a', 'A')] },
            incoming: { activeId: 'a', files: [doc('a', 'A'), doc('c', 'C')] },
            hasLocalPending: false
        })

        expect(result.state.files.map((f) => f.id)).toEqual(['a', 'c'])
        expect(result.forgetIds).toEqual([])
    })

    it('活动文档在别处被删且本页空闲时跟随改选并丢弃新活动文档缓存', () => {
        const result = reconcileDocumentState({
            current: { activeId: 'a', files: [doc('a', 'A'), doc('b', '旧B')] },
            incoming: { activeId: 'b', files: [doc('b', '新B')] },
            hasLocalPending: false
        })

        expect(result.state.activeId).toBe('b')
        expect(result.state.files.map((f) => f.id)).toEqual(['b'])
        expect(result.forgetIds).toContain('b')
    })

    it('活动文档在别处被删但本页有未落盘编辑时保住本地文档', () => {
        const result = reconcileDocumentState({
            current: { activeId: 'a', files: [doc('a', '未保存'), doc('b', 'B')] },
            incoming: { activeId: 'b', files: [doc('b', 'B')] },
            hasLocalPending: true
        })

        expect(result.state.activeId).toBe('a')
        expect(result.state.files.find((f) => f.id === 'a')?.content).toBe('未保存')
        expect(result.activeContent).toBeNull()
    })
})

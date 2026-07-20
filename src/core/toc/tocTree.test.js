import { describe, expect, it } from 'vitest'
import { computeTocView } from './tocTree.js'

const items = [
    { id: 'a', title: 'A', level: 1 },
    { id: 'a-1', title: 'A.1', level: 2 },
    { id: 'a-1-1', title: 'A.1.1', level: 3 },
    { id: 'a-2', title: 'A.2', level: 2 },
    { id: 'b', title: 'B', level: 1 }
]

describe('computeTocView', () => {
    it('未折叠时全部可见，并标注 hasChildren', () => {
        const { visibleItems } = computeTocView(items, new Set())
        expect(visibleItems.map((item) => item.id)).toEqual(['a', 'a-1', 'a-1-1', 'a-2', 'b'])
        expect(visibleItems.map((item) => item.hasChildren)).toEqual([true, true, false, false, false])
    })

    it('折叠某项隐藏其整棵子树，兄弟与外层不受影响', () => {
        const { visibleItems } = computeTocView(items, new Set(['a-1']))
        expect(visibleItems.map((item) => item.id)).toEqual(['a', 'a-1', 'a-2', 'b'])
        expect(visibleItems.find((item) => item.id === 'a-1').collapsed).toBe(true)
    })

    it('折叠顶层隐藏所有后代（含孙辈）', () => {
        const { visibleItems } = computeTocView(items, new Set(['a']))
        expect(visibleItems.map((item) => item.id)).toEqual(['a', 'b'])
    })

    it('激活项被折叠隐藏时，高亮回退到最近的可见祖先', () => {
        expect(computeTocView(items, new Set(['a-1']), 'a-1-1').displayActiveId).toBe('a-1')
        expect(computeTocView(items, new Set(['a']), 'a-1-1').displayActiveId).toBe('a')
        // 激活项自身可见时原样返回
        expect(computeTocView(items, new Set(['a-1']), 'a-2').displayActiveId).toBe('a-2')
    })

    it('容忍跳级标题（h1 直接接 h3）', () => {
        const skipped = [
            { id: 'x', title: 'X', level: 1 },
            { id: 'x-deep', title: 'X deep', level: 3 },
            { id: 'y', title: 'Y', level: 1 }
        ]
        const { visibleItems } = computeTocView(skipped, new Set(['x']))
        expect(visibleItems.map((item) => item.id)).toEqual(['x', 'y'])
        expect(computeTocView(skipped, new Set(['x']), 'x-deep').displayActiveId).toBe('x')
    })

    it('空列表与未知 activeId 不报错', () => {
        expect(computeTocView([], new Set(), 'nope')).toEqual({ visibleItems: [], displayActiveId: 'nope' })
    })
})

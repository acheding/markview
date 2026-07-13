import { describe, expect, it } from 'vitest'
import { createScrollMaster } from './scrollMaster.js'

// 内存版 PaneAdapter：setScrollTop 只改内部值，不自动派发事件；
// 测试通过手动调用 handleScroll 模拟浏览器的 scroll 事件，从而精确验证回声核销时序。
const createPane = (maxScrollTop = 1000, clientHeight = 400) => {
    let scrollTop = 0
    return {
        adapter: {
            getScrollTop: () => scrollTop,
            getMaxScrollTop: () => maxScrollTop,
            getClientHeight: () => clientHeight,
            setScrollTop: (top) => {
                scrollTop = top
            }
        },
        userScrollTo: (top) => {
            scrollTop = top
        },
        current: () => scrollTop
    }
}

// 1:1 线性锚点表：editor 偏移 == preview 偏移。
const linearAnchors = [
    { editor: 0, preview: 0 },
    { editor: 1000, preview: 1000 }
]

describe('createScrollMaster', () => {
    it('propagates a user scroll one-way and cancels the echo', () => {
        const editor = createPane()
        const preview = createPane()
        const master = createScrollMaster({
            editor: editor.adapter,
            preview: preview.adapter,
            getAnchors: () => linearAnchors
        })

        // 用户滚动编辑区 → 同步到预览区
        editor.userScrollTo(300)
        master.handleScroll('editor')
        expect(preview.current()).toBe(300)

        // 预览区随之派发 scroll 事件（程序滚动的回声）→ 不得反向传播回编辑区
        editor.userScrollTo(300) // 编辑区保持不动
        const editorBefore = editor.current()
        master.handleScroll('preview')
        expect(editor.current()).toBe(editorBefore)
    })

    it('cancels a coalesced echo that lands on a later queued target', () => {
        const editor = createPane()
        const preview = createPane()
        const master = createScrollMaster({
            editor: editor.adapter,
            preview: preview.adapter,
            getAnchors: () => linearAnchors
        })

        // 编辑区连续两次滚动 → 预览区排入两个期望值 [300, 600]，但真实 scrollTop 已到 600
        editor.userScrollTo(300)
        master.handleScroll('editor')
        editor.userScrollTo(600)
        master.handleScroll('editor')
        expect(preview.current()).toBe(600)

        // 浏览器把两次 scrollTo 合并成一个落在 600 的 scroll 事件：应命中队尾、核销、不反向传播
        const editorBefore = editor.current()
        master.handleScroll('preview')
        expect(editor.current()).toBe(editorBefore)
    })

    it('lets a user preemption on the other pane take over', () => {
        const editor = createPane()
        const preview = createPane()
        const master = createScrollMaster({
            editor: editor.adapter,
            preview: preview.adapter,
            getAnchors: () => linearAnchors
        })

        // 编辑区程序滚动预览区到 300，但回声事件尚未到达
        editor.userScrollTo(300)
        master.handleScroll('editor')
        expect(preview.current()).toBe(300)

        // 用户此时直接抢滚预览区到 700（与队头 300 不匹配）→ 作废旧期望并反向同步编辑区
        preview.userScrollTo(700)
        master.handleScroll('preview')
        expect(editor.current()).toBe(700)
    })

    it('aligns both panes to an editor line offset', () => {
        const editor = createPane(1000, 400)
        const preview = createPane(1000, 400)
        const master = createScrollMaster({
            editor: editor.adapter,
            preview: preview.adapter,
            getAnchors: () => linearAnchors
        })

        // 目标行像素 500，视口比例 0.3 → 编辑区定位到 500 - 400*0.3 = 380
        master.alignToEditorTop(500, { viewportRatio: 0.3 })
        expect(editor.current()).toBe(380)
        expect(preview.current()).toBe(380)
    })

    it('aligns both panes to independently measured positions', () => {
        const editor = createPane(2000, 400)
        const preview = createPane(3000, 500)
        const master = createScrollMaster({
            editor: editor.adapter,
            preview: preview.adapter,
            getAnchors: () => linearAnchors
        })

        master.alignToScrollTops(1432.4, 2288.7)

        expect(editor.current()).toBe(1432)
        expect(preview.current()).toBe(2289)
    })

    it('does not sync while disabled', () => {
        const editor = createPane()
        const preview = createPane()
        const master = createScrollMaster({
            editor: editor.adapter,
            preview: preview.adapter,
            getAnchors: () => linearAnchors,
            isEnabled: () => false
        })

        editor.userScrollTo(300)
        master.handleScroll('editor')
        expect(preview.current()).toBe(0)
    })
})

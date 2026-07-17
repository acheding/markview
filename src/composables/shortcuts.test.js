import { describe, expect, it } from 'vitest'
import { matchesShortcut, shortcutLabel } from './shortcuts.js'

const keyEvent = (key, { ctrl = false, meta = false, alt = false, shift = false } = {}) => ({
    key,
    ctrlKey: ctrl,
    metaKey: meta,
    altKey: alt,
    shiftKey: shift
})

describe('shortcutLabel', () => {
    it('mod+Alt 组合按「mod+Alt+大写字母」展示', () => {
        expect(shortcutLabel('new')).toMatch(/^(Ctrl|Cmd)\+Alt\+N$/)
    })

    it('单修饰组合不含 Alt 段', () => {
        expect(shortcutLabel('save')).toMatch(/^(Ctrl|Cmd)\+S$/)
        expect(shortcutLabel('toggle-editor')).toMatch(/^(Ctrl|Cmd)\+\\$/)
    })

    it('带 Shift 的组合展示 Shift 段', () => {
        expect(shortcutLabel('save-as')).toMatch(/^(Ctrl|Cmd)\+Shift\+S$/)
    })

    it('未注册键位的命令返回空串（命令面板即不展示快捷键）', () => {
        expect(shortcutLabel('export-md')).toBe('')
    })
})

describe('matchesShortcut', () => {
    it('mod+Alt 命令：Ctrl 与 Cmd（metaKey）均可触发', () => {
        expect(matchesShortcut(keyEvent('n', { ctrl: true, alt: true }), 'new')).toBe(true)
        expect(matchesShortcut(keyEvent('N', { meta: true, alt: true }), 'new')).toBe(true)
    })

    it('修饰键须精确匹配：缺 Alt、多 Alt、带 Shift 均不触发', () => {
        expect(matchesShortcut(keyEvent('n', { ctrl: true }), 'new')).toBe(false)
        expect(matchesShortcut(keyEvent('s', { ctrl: true, alt: true }), 'save')).toBe(false)
        expect(matchesShortcut(keyEvent('n', { ctrl: true, alt: true, shift: true }), 'new')).toBe(false)
    })

    // 测试跑在 node 环境（无 window，即不支持 File System Access）：
    // 「打开」整体不存在（无键位）；「导入」主键位 Ctrl+Alt+O，并额外兼容旧版的 Ctrl+O；
    // 展示只给主键位。支持时的归属（Ctrl+O 打开 / Ctrl+Alt+O 导入）见 shortcuts.js 的能力分支。
    it('不支持 File System Access 时「导入」主键位 Ctrl+Alt+O 并兼容 Ctrl+O，「打开」无键位', () => {
        expect(shortcutLabel('import')).toMatch(/^(Ctrl|Cmd)\+Alt\+O$/)
        expect(shortcutLabel('open')).toBe('')
        expect(matchesShortcut(keyEvent('o', { ctrl: true, alt: true }), 'import')).toBe(true)
        expect(matchesShortcut(keyEvent('o', { ctrl: true }), 'import')).toBe(true)
        expect(matchesShortcut(keyEvent('o', { ctrl: true, shift: true }), 'import')).toBe(false)
        expect(matchesShortcut(keyEvent('o', { ctrl: true }), 'open')).toBe(false)
    })

    it('Shift 修饰按注册值区分：Ctrl+S 与 Ctrl+Shift+S 互不串扰', () => {
        expect(matchesShortcut(keyEvent('s', { ctrl: true }), 'save')).toBe(true)
        expect(matchesShortcut(keyEvent('s', { ctrl: true }), 'save-as')).toBe(false)
        expect(matchesShortcut(keyEvent('S', { ctrl: true, shift: true }), 'save-as')).toBe(true)
        expect(matchesShortcut(keyEvent('S', { ctrl: true, shift: true }), 'save')).toBe(false)
        expect(matchesShortcut(keyEvent('S', { meta: true, shift: true }), 'save-as')).toBe(true)
    })

    it('无 mod 或键不符不触发；未注册 id 恒不触发', () => {
        expect(matchesShortcut(keyEvent('n', { alt: true }), 'new')).toBe(false)
        expect(matchesShortcut(keyEvent('m', { ctrl: true, alt: true }), 'new')).toBe(false)
        expect(matchesShortcut(keyEvent('e', { ctrl: true }), 'export-md')).toBe(false)
    })
})

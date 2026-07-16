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

    it('无 mod 或键不符不触发；未注册 id 恒不触发', () => {
        expect(matchesShortcut(keyEvent('n', { alt: true }), 'new')).toBe(false)
        expect(matchesShortcut(keyEvent('m', { ctrl: true, alt: true }), 'new')).toBe(false)
        expect(matchesShortcut(keyEvent('e', { ctrl: true }), 'export-md')).toBe(false)
    })
})

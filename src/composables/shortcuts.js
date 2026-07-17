// 快捷键单一来源：键位定义、展示文案、事件判定同出一处。
// 全局监听（createWorkspace）、命令面板、tooltip、文档搜索均按命令 id 从这里取，改键位只动本文件。

// 展示文案：macOS 显示 Cmd，其余平台显示 Ctrl；监听侧 ctrlKey/metaKey 双兼容，两端保持一致。
const modKey = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform) ? 'Cmd' : 'Ctrl'

// 命令 id → 键位，mod（Ctrl/Cmd）一律隐含。应用自定义命令统一 mod+Alt+字母
// （单修饰的 Ctrl+N/C 等被浏览器或系统占用）；标准语义沿用浏览器习惯的单修饰。
const SHORTCUTS = {
    new: { key: 'n', alt: true },
    share: { key: 'c', alt: true },
    clear: { key: 'x', alt: true },
    theme: { key: 'l', alt: true },
    save: { key: 's' },
    import: { key: 'o' },
    find: { key: 'f' },
    'toggle-editor': { key: '\\' },
    palette: { key: 'p' },
    search: { key: 'k' }
}

// 展示文案，如 'Ctrl+Alt+N' / 'Cmd+\'；未注册键位的命令返回空串（命令面板即不展示）。
export const shortcutLabel = (id) => {
    const binding = SHORTCUTS[id]
    if (!binding) return ''
    return [modKey, binding.alt ? 'Alt' : '', binding.key.toUpperCase()].filter(Boolean).join('+')
}

// 事件是否命中指定命令的键位：修饰键须精确匹配（Shift 一律不参与、Alt 按注册值），
// 保证触发条件与 shortcutLabel 展示的组合严格一致。
export const matchesShortcut = (event, id) => {
    const binding = SHORTCUTS[id]
    if (!binding) return false
    if (!(event.ctrlKey || event.metaKey) || event.shiftKey) return false
    if (Boolean(binding.alt) !== event.altKey) return false
    return event.key.toLowerCase() === binding.key
}

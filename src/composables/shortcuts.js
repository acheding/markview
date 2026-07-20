// 快捷键单一来源：键位定义、展示文案、事件判定同出一处。
// 全局监听（createWorkspace）、命令面板、tooltip、文档搜索均按命令 id 从这里取，改键位只动本文件。
import { isFileSystemAccessSupported } from '../core/documents/fileAccess.js'

// 展示文案：macOS 显示 Cmd，其余平台显示 Ctrl；监听侧 ctrlKey/metaKey 双兼容，两端保持一致。
const modKey = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform) ? 'Cmd' : 'Ctrl'

// 命令 id → 键位（单个绑定或绑定数组，数组首个为主键位、用于展示），mod（Ctrl/Cmd）一律隐含。
// 应用自定义命令统一 mod+Alt+字母（单修饰的 Ctrl+N/C 等被浏览器或系统占用）；标准语义沿用浏览器习惯的单修饰。
// O 键一族按能力归属：支持 File System Access 时 Ctrl+O 给「打开本地文件」、Ctrl+Alt+O 给「导入文件」；
// 不支持的浏览器里「打开」整体不存在（无按钮、无命令、无键位），「导入」除 Ctrl+Alt+O 外
// 额外兼容 Ctrl+O（延续旧版「Ctrl+O 导入」的肌肉记忆，展示仍以 Ctrl+Alt+O 为准）。
const SHORTCUTS = {
    new: { key: 'n', alt: true },
    share: { key: 'c', alt: true },
    clear: { key: 'x', alt: true },
    theme: { key: 'l', alt: true },
    save: { key: 's' },
    'save-as': { key: 's', shift: true },
    ...(isFileSystemAccessSupported()
        ? { open: { key: 'o' }, import: { key: 'o', alt: true } }
        : { import: [{ key: 'o', alt: true }, { key: 'o' }] }),
    find: { key: 'f' },
    format: { key: 'f', alt: true },
    // 插入代码块用 mod+Alt+K；纯 Ctrl+K 是全局搜索，两者靠 Alt 精确区分（见 matchesShortcut）。
    'code-block': { key: 'k', alt: true },
    'toggle-editor': { key: '\\' },
    palette: { key: 'p' },
    search: { key: 'k' }
}

const bindingsOf = (id) => {
    const value = SHORTCUTS[id]
    if (!value) return []
    return Array.isArray(value) ? value : [value]
}

// 展示文案，如 'Ctrl+Alt+N' / 'Cmd+\'；多绑定只展示主键位；未注册键位的命令返回空串（命令面板即不展示）。
export const shortcutLabel = (id) => {
    const [binding] = bindingsOf(id)
    if (!binding) return ''
    return [modKey, binding.shift ? 'Shift' : '', binding.alt ? 'Alt' : '', binding.key.toUpperCase()]
        .filter(Boolean)
        .join('+')
}

// 事件是否命中指定命令的任一键位：修饰键（Shift/Alt）须与注册值精确匹配，
// 保证触发条件与 shortcutLabel 展示的组合严格一致（兼容绑定除外，属有意的隐藏键位）。
export const matchesShortcut = (event, id) => {
    if (!(event.ctrlKey || event.metaKey)) return false
    return bindingsOf(id).some(
        (binding) =>
            Boolean(binding.shift) === event.shiftKey &&
            Boolean(binding.alt) === event.altKey &&
            event.key.toLowerCase() === binding.key
    )
}

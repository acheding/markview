// 快捷键展示文案：macOS 显示 Cmd，其余平台显示 Ctrl，
// 与全局监听（createWorkspace / CommandPalette）的 ctrlKey/metaKey 判定保持一致。
export const modKey = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform) ? 'Cmd' : 'Ctrl'

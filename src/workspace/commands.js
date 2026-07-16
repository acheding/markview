// 命令注册表：命令的 id、标题、行为的单一来源；键位与文案按 id 关联到 composables/shortcuts.js。
// 全局快捷键监听（createWorkspace）与命令面板（CommandPalette）消费同一份列表，
// 新增命令 / 改行为只动这里，改键位只动 shortcuts.js，两侧不会再漏改其一。
// 标题写成函数：折叠态 / 主题等动态标题在展示时求值，命令面板的 computed 顺势收集依赖。
export const createCommands = ({
    documents,
    layout,
    actions,
    exporting,
    theme,
    toggleTheme,
    share,
    openImportPicker,
    saveNow
}) => [
    { id: 'new', title: () => '新建文档', run: () => documents.create() },
    { id: 'import', title: () => '导入文件', hint: 'Markdown / 文本', run: () => openImportPicker() },
    {
        id: 'toggle-editor',
        title: () => (layout.isEditorCollapsed.value ? '展开编辑区' : '折叠编辑区'),
        run: () => actions.setEditorCollapsed(!layout.isEditorCollapsed.value)
    },
    // 不透传调用处的事件对象：share 的入参是锚点，只接受显式字符串。
    { id: 'share', title: () => '复制分享链接', run: () => share() },
    { id: 'clear', title: () => '清空当前内容', run: () => actions.clearContent() },
    {
        id: 'theme',
        title: () => (theme.value === 'dark' ? '切换到浅色主题' : '切换到暗色主题'),
        run: () => toggleTheme()
    },
    // 内容本就自动落盘，Ctrl+S 仅作「立即保存 + 提示」的显式动作，不进命令面板。
    { id: 'save', title: () => '保存到本地', inPalette: false, run: () => saveNow() },
    { id: 'export-md', title: () => '导出 Markdown', run: () => exporting.exportActiveFile() },
    { id: 'export-html', title: () => '导出 HTML', run: () => exporting.exportHtml() },
    { id: 'print', title: () => '导出 PDF / 打印', hint: '浏览器打印，可另存 PDF', run: () => exporting.print() }
]

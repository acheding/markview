// 命令注册表：命令的 id、标题、行为的单一来源；键位与文案按 id 关联到 composables/shortcuts.js。
// 全局快捷键监听（createWorkspace）与命令面板（CommandPalette）消费同一份列表，
// 新增命令 / 改行为只动这里，改键位只动 shortcuts.js，两侧不会再漏改其一。
// 标题写成函数：折叠态 / 主题等动态标题在展示时求值，命令面板的 computed 顺势收集依赖。
// inPalette 亦可为函数：按能力（如 File System Access 支持与否）动态决定是否进面板。
export const createCommands = ({
    layout,
    actions,
    exporting,
    theme,
    toggleTheme,
    share,
    openImportPicker,
    createNewDocument,
    saveNow,
    saveAs,
    formatDocument,
    disk
}) => [
    // createNewDocument 而非 documents.create：新建后顺带把光标聚焦进编辑区（见 createWorkspace）。
    { id: 'new', title: () => '新建文档', run: () => createNewDocument() },
    // 「打开」与「导入」是两个并存的入口，不做二选一：
    // 打开 = 保留句柄、Ctrl+S 写回原文件，仅支持 File System Access 时存在（不支持的浏览器
    //        无按钮、不进面板、Ctrl+O 键位归还「导入」，见 shortcuts.js）；
    // 导入 = 拷贝一份进工作区、与磁盘断开，始终可用。
    {
        id: 'open',
        title: () => '打开本地文件',
        hint: 'Markdown，可写回原文件',
        inPalette: () => disk.isSupported,
        run: () => disk.openFilePicker()
    },
    {
        id: 'import',
        title: () => '导入文件',
        hint: 'Markdown / 文本，导入副本',
        run: () => openImportPicker()
    },
    // Ctrl+F 的唯一入口（编辑器键位表已剔除 Mod-F）；编辑区折叠时会先展开再唤起面板。
    { id: 'find', title: () => '查找替换', hint: '当前文档', run: () => actions.openFindPanel() },
    // Prettier 整篇格式化（含受支持语言的代码块），一步 Ctrl+Z 可整体撤销；见 createWorkspace。
    {
        id: 'format',
        title: () => '格式化文档',
        hint: '规范 Markdown 与代码块',
        run: () => formatDocument()
    },
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
    // 内容本就自动落盘，Ctrl+S 对普通文档仅作「立即保存 + 提示」；关联本地文件的文档则写回磁盘。
    // 术语约定：「本地」只指磁盘文件；IndexedDB 侧一律说「保存 / 保存在 MarkView 中」，不再用「本地」。
    {
        id: 'save',
        title: () => (disk.activeLink.value ? '写回本地文件' : '立即保存'),
        inPalette: false,
        run: () => saveNow()
    },
    // 另存为本地文件并打开（Ctrl+Shift+S）；不支持 File System Access 时快捷键降级为下载导出、不进面板。
    {
        id: 'save-as',
        title: () => '另存为本地文件',
        hint: '另存为本地文件并打开',
        inPalette: () => disk.isSupported,
        run: () => saveAs()
    },
    { id: 'export-md', title: () => '导出 Markdown', run: () => exporting.exportActiveFile() },
    { id: 'export-html', title: () => '导出 HTML', run: () => exporting.exportHtml() },
    { id: 'print', title: () => '导出 PDF / 打印', hint: '浏览器打印，可另存 PDF', run: () => exporting.print() }
]

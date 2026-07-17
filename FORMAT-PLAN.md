# 一键格式化功能：方案与实施进度

> 工作交接文档（2026-07-17）。**第一阶段已全部完成并通过验证**，本文件仅存档备查，可删除。
> 剩余工作只有「四、第二阶段」，需用户确认后再开工。

## 一、需求与设计结论

**需求**：输入的 Markdown / 代码可以一键格式化（第一阶段）；「保存时自动格式化」留作第二阶段。

**方案**：Prettier standalone（浏览器端）整篇格式化。

- 一次覆盖两层：① 整篇 Markdown 结构（表格对齐、列表符号统一 `-`、粗体统一 `**`、空行规范）；② 围栏代码块内代码（js / json / css / html；front matter 走 yaml 插件）。
- Prettier 不认识的语言块（python、mermaid 等）**原样保留，不会被破坏**；数学公式 `$...$` 不受影响。
- 关键选项 `proseWrap: 'preserve'`：不重排正文换行，中文段落安全。
- 光标用 `formatWithCursor` 映射，格式化后光标保持原位、滚动跟随。
- 插件全部动态 `import()`：Vite 拆异步 chunk，首次点「格式化」才下载，主包零增长。
- 触发入口：命令面板「格式化文档」+ 快捷键 `Ctrl+Alt+F`（符合本项目「自定义命令 mod+Alt+字母」约定，不与 Ctrl+F 查找冲突）。
- 一次 dispatch = 一步撤销，Ctrl+Z 可整体回退。
- 竞态防护：格式化是异步的，应用前核对文档未被改过（期间用户继续输入则静默放弃）；`isFormatting` 防连按重入。
- 明确不做「边打边格式化」：会与输入中的半成品语法（未闭合的表格 / `**`）打架。

## 二、已完成的改动（代码已写好）

| 文件 | 改动 |
|---|---|
| `package.json` | prettier 从 devDependencies 移入 dependencies（现为 3.9.5），lockfile 已更新 |
| `src/services/formatter.js` | **新建**。懒加载 prettier/standalone + markdown/yaml/babel/estree/postcss/html 插件；导出 `formatMarkdown(text, cursorOffset)` → `{ formatted, cursorOffset }`；加载失败不缓存 rejected promise，可重试 |
| `src/editor/EditorController.js` | 新增 `getCursorOffset()`；新增 `applyFormatted(text, anchor)`：整段替换 + 光标定位 + scrollIntoView，单次 dispatch 单步撤销 |
| `src/workspace/createWorkspace.js` | 新增 `formatDocument()`（模式同 saveNow）：取文档 → formatMarkdown → 核对文档未变 → applyFormatted + toast；无变化 toast「内容已符合格式」；异常 toast「格式化失败」；传入 createCommands |
| `src/workspace/commands.js` | 注册 `{ id: 'format', title: '格式化文档', hint: '规范 Markdown 与代码块' }`（列在「查找替换」之后），命令面板自动收录 |
| `src/composables/shortcuts.js` | 加 `format: { key: 'f', alt: true }` → 展示为 Ctrl/Cmd+Alt+F |

架构接线（供恢复上下文）：快捷键 → `createWorkspace.handleKeydown` → 命令表 `run()` → `formatDocument()` → `services/formatter.js` → `EditorController.applyFormatted` → CodeMirror dispatch → `onDocChanged` 自动同步 documents → 预览重渲染。编辑区折叠只是 CSS 宽度归零，控制器存活，折叠态格式化同样可用。

## 三、质量关卡（全部通过 ✅）

1. **单元测试** `src/services/formatter.test.js`：7 个用例全过——表格对齐 / 列表符号统一、js 代码块格式化、mermaid 与 python 块原样保留、中文长段不折行、光标映射、YAML front matter、幂等（已符合格式则输出不变）。
2. **README 已同步**：编辑与预览节新增「一键格式化」条目；命令面板命令列表与 `Ctrl+Alt` 快捷键族补上「格式化」。
3. **`pnpm check` 全绿**（lint + format:check + 175 测试 + build）。prettier 各插件 chunk 均为独立异步 chunk（最大 babel 320KB / gzip 83KB），全部低于 PWA precache 单文件 2MB 上限，155 个条目正常预缓存。
4. **浏览器端到端（Playwright）9 项断言全过**：toast「已格式化」、表格对齐、列表统一、js 块格式化、mermaid 原样、中文不折行、光标保持原位、重复格式化提示「内容已符合格式」、Ctrl+Z 撤销干净。

**验证中发现并修复的真 bug**：格式化事务会与 500ms 内紧接的输入被 CodeMirror history 合并成一步 undo（一次 Ctrl+Z 连输入带格式化一起回退）。修复：`applyFormatted` 的 dispatch 加 `annotations: isolateHistory.of('full')`（`@codemirror/commands`），强制格式化独占一步历史。

## 四、遗留 / 第二阶段（未开工，需用户确认再做）

- 「保存时格式化」开关：Ctrl+S 写回前自动格式化，默认关，`useLocalStoragePreference` 持久化，命令面板加切换命令。
- 可选：编辑区工具栏加格式化按钮（当前入口为命令面板 + 快捷键）。
- 可选：ts 代码块格式化需另加 `prettier/plugins/typescript`（chunk 较大，暂不引入；ts 块现状为原样保留）。

## 五、建议 commit message

```
feat: 一键格式化文档（Ctrl+Alt+F）——Prettier 整篇规范 Markdown 与代码块，光标保持原位
```

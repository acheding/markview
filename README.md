# README

一个基于 Vue 3 和 Vite 构建的本地 Markdown 实时预览工具。提供左右分栏编辑、实时渲染、多文档管理、文件导入导出、PDF 导出、目录导航、跨文档搜索、滚动同步、编辑区折叠/展开、代码高亮等能力，适合用来快速编写或预览文档。

## 功能特性

- **实时预览**：左侧输入 Markdown，右侧即时渲染结果。
- **多文档工作区**：支持新建、切换、删除、导入多个本地文档。
- **文件导入导出**：支持导入 `.md` / `.markdown` / 文本文件，可导出 Markdown 文档或 PDF。
- **全文搜索**：按文件名和正文内容跨文档搜索，`Ctrl + K` 快速唤起，支持精确定位到行。
- **自动保存**：文档内容自动保存到浏览器 `IndexedDB`。
- **智能命名**：根据文档标题或正文内容自动生成文件名，导入文件同样使用内容识别命名。
- **目录导航**：根据标题自动生成目录，点击跳转，当前标题高亮自动跟随。
- **标题锚点**：预览区标题带 `#` 锚点，hover 显示，点击复制带 hash 的完整链接到剪贴板。
- **滚动同步**：编辑区与预览区按源码行号联动滚动，双向同步。
- **编辑区折叠**：支持折叠编辑区专注预览，折叠后文件名和操作按钮移至预览区头部。
- **代码高亮**：内置 `highlight.js`，支持 JavaScript、TypeScript、Python、CSS、Bash 等。
- **文档统计**：实时显示行数、字数和字符数。
- **回到顶部**：预览区滚动较深时显示快捷返回按钮。
- **可调布局**：编辑区、预览区、目录宽度均支持拖拽调整。
- **响应式界面**：桌面端左右分栏，移动端上下布局，折叠状态自动适配。

## 技术栈

- [Vue 3](https://vuejs.org/)：组合式 API + `<script setup>`
- [Vite](https://vitejs.dev/)：开发服务器与构建工具
- [marked](https://marked.js.org/)：Markdown 解析
- [highlight.js](https://highlightjs.org/)：代码块语法高亮

## 快速开始

请确保本地已安装 Node.js 和 pnpm。

```bash
pnpm install
pnpm dev
```

开发服务器默认运行在：

```text
http://localhost:3001/
```

## 使用提示

- **文档切换**：点击编辑器标题栏左侧文件名下拉切换，折叠状态下预览区头部同样可切换。
- **操作按钮**：标题栏右侧依次为新建、清空、导入、导出 Markdown（md）、导出 PDF、折叠/展开编辑区。
- **导入**：支持一次选择多个 Markdown 或文本文件，文件名由内容自动生成。
- **导出**：Markdown 导出下载 `.md` 文件；PDF 导出下载 `.pdf` 文件。
- **搜索**：`Ctrl + K` 唤起搜索框，输入关键词跨文档检索，选中结果后精确定位到目标行。
- **折叠编辑区**：点击 `<` 按钮折叠编辑区，专注预览；点击预览区头部 `>` 按钮恢复。
- **调整布局**：拖拽分割条调整编辑区/预览区宽度；拖拽目录区左侧边缘调整目录宽度。
- **回到顶部**：预览区滚动超过一定距离后右下角出现返回按钮；目录会随当前标题高亮自动滚动。

## 常用命令

```bash
pnpm dev      # 启动开发环境
pnpm build    # 构建生产版本
pnpm preview  # 本地预览生产构建
pnpm check    # 构建检查
```

## 项目结构

```text
.
├── public/                         # 静态资源
├── src/
│   ├── assets/                     # SVG 图标资源
│   │   ├── back-to-top.svg
│   │   ├── clear-content.svg
│   │   ├── collapse-editor.svg
│   │   ├── delete-file.svg
│   │   ├── expand-editor.svg
│   │   ├── export-file.svg
│   │   ├── export-pdf.svg
│   │   ├── import-file.svg
│   │   └── new-file.svg
│   ├── components/                 # 页面组件
│   │   ├── AppToolbar.vue          # 顶部工具栏 + 搜索入口
│   │   ├── ContentViewSkeleton.vue # 加载骨架屏
│   │   ├── DocumentSearch.vue      # 跨文档搜索弹窗
│   │   ├── FileSwitcher.vue        # 文档切换下拉
│   │   ├── MarkdownEditor.vue      # Markdown 编辑区
│   │   ├── MarkdownPreview.vue     # Markdown 预览区
│   │   ├── PanelToolbar.vue        # 共享工具栏（文件名 + 操作按钮）
│   │   ├── ResizeDivider.vue       # 面板拖拽分割条
│   │   └── TableOfContents.vue     # 目录导航
│   ├── composables/                # 组合式逻辑
│   │   ├── useDocumentExport.js    # 文档导出（Markdown / PDF）
│   │   ├── useHeadingNavigation.js # 标题 hash 导航
│   │   ├── useLocalStoragePreference.js # 用户偏好持久化
│   │   ├── useMarkdownDocuments.js # 多文档状态管理 + IndexedDB
│   │   ├── useMarkdownRenderer.js  # Markdown 解析与渲染
│   │   ├── usePaneResize.js        # 面板宽度拖拽
│   │   ├── useScrollSync.js        # 编辑/预览滚动同步
│   │   └── useTocResize.js         # 目录宽度拖拽
│   ├── constants/                  # 编辑器常量
│   ├── utils/                      # 通用工具函数
│   ├── App.vue                     # 应用主界面
│   ├── main.js                     # 应用入口
│   └── style.css                   # 全局样式
├── index.html
├── package.json
└── vite.config.js
```

## 部署说明

通过 `VITE_APP_PATH` 控制 Vite 的 `base` 路径：

- `.env.development`：本地开发默认 `/`
- `.env.production`：生产构建默认 `/markview/`

部署到 GitHub/Gitee Pages 时，如果仓库名不是 `markview`，修改 `.env.production`：

```env
VITE_APP_PATH=/your-repo-name/
```

部署到根域名或自定义域名：

```env
VITE_APP_PATH=/
```

然后执行：

```bash
pnpm build
```

构建产物生成在 `dist/` 目录。

## 数据存储

MarkView 不依赖后端服务，所有文档数据保存在浏览器 `IndexedDB` 中。清理浏览器站点数据、更换浏览器或更换域名路径后，本地保存的内容可能无法继续读取。建议定期导出重要文档备份。

## Markdown 语法演示

以下内容演示 MarkView 支持的常见 Markdown 语法，可直接在编辑器中修改查看效果。

### 1. 标题

# H1 标题

## H2 标题

### H3 标题

### 2. 列表

- 无序列表项 1
- 无序列表项 2
    - 嵌套列表项 2.1
    - 嵌套列表项 2.2
- 无序列表项 3

1. 有序列表项 1
2. 有序列表项 2
3. 有序列表项 3

### 3. 代码块

```javascript
function greet(name) {
    console.log(`你好，${name}！`)
    return `欢迎 ${name}`
}

greet('Vue 3 开发者')
```

```python
def fibonacci(n):
    a, b = 0, 1
    for _ in range(n):
        yield a
        a, b = b, a + b

print(list(fibonacci(10)))
```

### 4. 表格

| 名称     | 类型     | 描述                   |
| -------- | -------- | ---------------------- |
| Vue      | 框架     | 渐进式 JavaScript 框架 |
| Vite     | 构建工具 | 下一代前端构建工具     |
| Markdown | 标记语言 | 轻量级标记语言         |

### 5. 引用

> 技术不在于复杂，而在于优雅地解决问题。
> -- 某位开发者

### 6. 链接与图片

[访问 Vue 官网](https://vuejs.org/)

![Vue Logo](https://vuejs.org/images/logo.png)

### 7. 其他样式

- **粗体文字**
- _斜体文字_
- ~~删除线~~
- `行内代码`

---

试试在左侧编辑区修改内容，右侧会实时更新。

## 开源协议

本项目基于 MIT License 开源，详见 [LICENSE](./LICENSE)。

# README

一个基于 Vue 3 和 Vite 构建的本地 Markdown 实时预览工具。左侧编辑，右侧实时渲染；提供多文档管理、文件导入导出、PDF 导出、目录导航、跨文档搜索、滚动同步、编辑区折叠/展开等能力，适合用来快速编写或预览文档。所有数据保存在浏览器本地，无需后端。

## 功能特性

- **代码编辑器**：基于 CodeMirror 6，带行号、语法高亮、智能补全。
- **实时预览**：左侧输入 Markdown，右侧即时渲染结果。
- **智能补全**：输入链接 `](` 时补全工作区文档路径与当前文档的标题锚点；代码块内按语言（JavaScript / TypeScript / CSS / HTML / Python 等）补全。
- **多文档工作区**：支持新建、切换、删除、导入多个本地文档，每个文档拥有独立的撤销历史。
- **文件导入导出**：支持导入 `.md` / `.markdown` / 文本文件，可导出 Markdown 文档或 PDF。
- **全文搜索**：按文件名和正文内容跨文档搜索，`Ctrl + K` 快速唤起，选中结果精确定位到行并双侧高亮。
- **自动保存**：文档内容自动保存到浏览器 `IndexedDB`，增量写入并显示保存状态。
- **智能命名**：根据文档标题或正文内容自动生成文件名，导入文件同样使用内容识别命名。
- **目录导航**：根据标题自动生成目录，点击跳转，当前标题高亮自动跟随。
- **标题锚点**：预览区标题带 `#` 锚点，hover 显示，点击复制带 hash 的完整链接到剪贴板；刷新或新标签打开可直达对应标题。
- **滚动同步**：编辑区与预览区按源码行号联动滚动，双向同步。
- **编辑区折叠**：支持折叠编辑区专注预览，折叠后文件名和操作按钮移至预览区头部。
- **代码高亮**：预览区用 `highlight.js`；编辑区代码块按围栏语言（js/ts/css/html/python/json/xml 等）解析高亮。
- **文档统计**：实时显示行数、字数和字符数。
- **回到顶部**：预览区滚动较深时显示快捷返回按钮。
- **可调布局**：编辑区、预览区、目录宽度均支持拖拽调整。
- **响应式界面**：桌面端左右分栏，移动端上下布局，折叠状态自动适配。

## 技术栈

- [Vue 3](https://vuejs.org/)：组合式 API + `<script setup>`
- [Vite](https://vitejs.dev/)：开发服务器与构建工具
- [CodeMirror 6](https://codemirror.net/)：编辑器（语法高亮、补全、行号等）
- [marked](https://marked.js.org/)：Markdown 解析
- [highlight.js](https://highlightjs.org/)：预览区代码块语法高亮
- [Vitest](https://vitest.dev/)：核心逻辑单元测试

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
pnpm test     # 运行单元测试（Vitest）
pnpm lint     # ESLint 检查
pnpm format   # Prettier 格式化
pnpm check    # 一键校验：lint + 格式检查 + 测试 + 构建
```

## 项目结构

采用分层架构，依赖单向向下：组件只负责 UI（`inject` 工作区直接消费），业务状态与横切编排集中在 `workspace`，编辑器 / 预览的命令式能力封装为 controller，纯逻辑下沉到 `core`（不依赖 Vue、不直接操作 DOM，便于单元测试）。

```text
src/
├── main.js / App.vue        # 入口 + 根布局（组装并 provide 工作区，渲染骨架屏 / 分栏）
├── styles/                  # 设计 token 与全局样式（tokens / base / markdown / highlights）
├── core/                    # 纯逻辑领域层（零 Vue、零 DOM，Vitest 直测）
│   ├── documents/           # 文档模型、IndexedDB 存储、保存状态机
│   ├── search/              # 跨文档搜索、匹配、摘要
│   ├── markdown/            # marked 渲染、源行标注、代码高亮、slug 生成
│   ├── sync/                # 滚动锚点表与防回环
│   └── text.js              # 通用文本工具
├── editor/                  # CodeMirror 6 封装（无 Vue）
│   ├── EditorController.js  # 编辑器唯一门面（多文档独立 EditorState）
│   └── extensions/          # 主题、语法高亮、行链接/代码补全、搜索高亮、代码语言等扩展
├── preview/                 # 预览 DOM 门面（源行定位、搜索高亮）
├── workspace/               # 响应式状态 + 横切编排
│   ├── createWorkspace.js   # 组装会话 / 控制器 / 生命周期，provide 下发
│   ├── documentSession.js   # 多文档状态与持久化
│   ├── searchSession.js     # 搜索查询与命中
│   ├── layoutSession.js     # 分栏宽度 / 折叠 / 目录宽度
│   ├── headingNavigation.js # 标题 hash 导航
│   └── orchestrations.js    # 搜索定位、折叠展开等跨子系统流程
├── composables/             # 通用 UI 工具（拖拽、媒体查询、偏好持久化、过渡等待）
├── services/exporter.js     # Markdown / PDF 导出
├── components/              # 哑组件（AppToolbar / EditorPane / PreviewPane / 工具栏等）
├── constants/presets.js     # 预置文档
└── assets/                  # SVG 图标资源
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

# MarkView

一个基于 Vue 3 和 Vite 构建的本地 Markdown 实时预览工具。MarkView 提供左右分栏编辑、实时渲染、目录导航、多文档管理、全文搜索、滚动同步和代码高亮，适合用来快速编写说明文档、笔记、博客草稿或 README。

## 功能特性

- 实时预览：左侧输入 Markdown，右侧即时渲染结果。
- 多文档工作区：支持新建、切换、删除多个本地文档。
- 全文搜索：支持按文件名和正文内容跨文档搜索，并可通过 `Ctrl + K` 快速唤起。
- 自动保存：文档内容会自动保存到浏览器 `localStorage`。
- 智能命名：根据文档标题或正文内容自动生成 `.md` 文件名。
- 目录导航：根据标题自动生成目录，并支持点击跳转。
- 标题锚点：预览区标题带有可跳转的 hash 锚点。
- 滚动同步：编辑区和预览区会根据源行位置进行联动滚动。
- 代码高亮：内置 `highlight.js`，支持常见语言高亮。
- 文档统计：实时显示行数、字数和字符数。
- 可调布局：支持拖拽调整编辑区、预览区和目录宽度。
- 响应式界面：桌面端左右分栏，移动端上下布局。

## 技术栈

- [Vue 3](https://vuejs.org/)：前端界面与组合式逻辑
- [Vite](https://vitejs.dev/)：开发服务器和构建工具
- [marked](https://marked.js.org/)：Markdown 解析
- [highlight.js](https://highlightjs.org/)：代码块语法高亮

## 快速开始

请确保本地已经安装 Node.js 和 pnpm。

```bash
pnpm install
pnpm dev
```

开发服务器默认运行在：

```text
http://localhost:3001/
```

## 常用命令

```bash
# 启动开发环境
pnpm dev

# 构建生产版本
pnpm build

# 本地预览生产构建
pnpm preview

# 构建检查
pnpm check
```

## 项目结构

```text
.
├── public/                  # 静态资源
├── src/
│   ├── assets/              # 图标和图片资源
│   ├── components/          # 页面组件
│   │   ├── AppToolbar.vue
│   │   ├── DocumentSearch.vue
│   │   ├── FileSwitcher.vue
│   │   ├── MarkdownEditor.vue
│   │   ├── MarkdownPreview.vue
│   │   ├── ResizeDivider.vue
│   │   └── TableOfContents.vue
│   ├── composables/         # 组合式逻辑
│   ├── constants/           # 编辑器常量
│   ├── utils/               # 通用工具函数
│   ├── App.vue              # 根组件
│   ├── MarkdownApp.vue      # Markdown 工作台主界面
│   ├── main.js              # 应用入口
│   └── style.css            # 全局样式
├── index.html
├── package.json
└── vite.config.js
```

## 部署说明

项目通过 `VITE_APP_PATH` 控制 Vite 的 `base` 路径：

- `.env.development`：本地开发默认使用 `/`
- `.env.production`：生产构建默认使用 `/markview/`

如果你要部署到 GitHub Pages，并且仓库名不是 `markview`，请将 `.env.production` 中的路径改成你的仓库名，例如：

```env
VITE_APP_PATH = /your-repo-name/
```

如果部署到根域名或自定义域名根路径，可以改成：

```env
VITE_APP_PATH = /
```

然后执行：

```bash
pnpm build
```

构建产物会生成在 `dist/` 目录。

## 数据存储

MarkView 不依赖后端服务，所有文档数据都会保存在当前浏览器的 `localStorage` 中。清理浏览器站点数据、更换浏览器或更换域名路径后，本地保存的内容可能无法继续读取。

## 开源协议

本项目基于 MIT License 开源，详见 [LICENSE](./LICENSE)。

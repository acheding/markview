# MarkView

一个基于 Vue 3 和 Vite 构建的本地 Markdown 实时预览工具。MarkView 提供左右分栏编辑、实时渲染、多文档管理、文件导入导出、目录导航、跨文档搜索、滚动同步、代码高亮和回到顶部等能力，适合用来快速编写或预览文档。

## 功能特性

- 实时预览：左侧输入 Markdown，右侧即时渲染结果。
- 多文档工作区：支持新建、切换、删除、导入多个本地文档。
- 文件导入导出：支持导入 `.md` / `.markdown` / 文本文件，并可导出当前 Markdown 文档。
- 全文搜索：支持按文件名和正文内容跨文档搜索，并可通过 `Ctrl + K` 快速唤起。
- 自动保存：文档内容会自动保存到浏览器 `IndexedDB`。
- 智能命名：根据文档标题或正文内容自动生成 `.md` 文件名。
- 目录导航：根据标题自动生成目录，支持点击跳转和高亮项自动跟随。
- 标题锚点：预览区标题带有可跳转的 hash 锚点。
- 滚动同步：编辑区和预览区会根据源行位置进行联动滚动。
- 代码高亮：内置 `highlight.js`，支持常见语言高亮。
- 文档统计：实时显示行数、字数和字符数。
- 回到顶部：预览区滚动较深时显示快捷返回按钮。
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

## 使用提示

- 编辑器标题栏左侧可以切换当前文档，右侧图标依次提供新建、清空、导入和导出操作。
- 导入支持一次选择多个 Markdown 或文本文件，文件会加入当前工作区并自动切换到最后导入的文档。
- 导出会下载当前文档内容，文件名优先使用文档标题自动生成。
- 预览区滚动超过一定距离后会显示回到顶部按钮；右侧目录会随着当前标题高亮自动滚动到可见位置。

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
VITE_APP_PATH=/your-repo-name/
```

如果部署到根域名或自定义域名根路径，可以改成：

```env
VITE_APP_PATH=/
```

然后执行：

```bash
pnpm build
```

构建产物会生成在 `dist/` 目录。

## 数据存储

MarkView 不依赖后端服务，所有文档数据都会保存在当前浏览器的 `IndexedDB` 中。清理浏览器站点数据、更换浏览器或更换域名路径后，本地保存的内容可能无法继续读取。

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

| 名称 | 类型 | 描述 |
|------|------|------|
| Vue | 框架 | 渐进式 JavaScript 框架 |
| Vite | 构建工具 | 下一代前端构建工具 |
| Markdown | 标记语言 | 轻量级标记语言 |

### 5. 引用

> 技术不在于复杂，而在于优雅地解决问题。
> -- 某位开发者

### 6. 链接与图片

[访问 Vue 官网](https://vuejs.org/)

![Vue Logo](https://vuejs.org/images/logo.png)

### 7. 其他样式

- **粗体文字**
- *斜体文字*
- ~~删除线~~
- `行内代码`

---

试试在左侧编辑区修改内容，右侧会实时更新。

## 开源协议

本项目基于 MIT License 开源，详见 [LICENSE](./LICENSE)。

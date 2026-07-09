# 用 Vue 3 + Vite 打造一个本地 Markdown 实时预览工具

## 前言

Markdown 是开发者最常使用的写作格式之一。无论是 README、技术博客草稿、接口说明、团队知识库，还是现在越来越常见的 AI Skill 使用说明，Markdown 都足够轻量，也方便纳入版本管理。

随着使用场景越来越多，团队里需要修改、预览的 Markdown 文档也明显变多。编辑区和预览区来回切换影响节奏；长文档缺少目录导航；滚动到某个段落后编辑区和预览区不容易对齐；写多篇草稿时希望能在浏览器里直接保存、切换、搜索、导入和导出。

基于这些需求，做了一个本地 Markdown 实时预览工具 MarkView。它使用 Vue 3 和 Vite 构建，不依赖后端服务，打开网页就可以完成编辑、预览、多文档管理、文件导入导出、PDF 导出、跨文档搜索、目录跳转、滚动同步和自动保存。

## 功能概览

- **左右分栏编辑**：左侧输入 Markdown，右侧实时渲染预览。
- **多文档工作区**：支持新建、切换、删除和导入多个本地文档。
- **文件导入导出**：支持导入 `.md`、`.markdown` 和文本文件，也可导出 Markdown 或 PDF。
- **全文搜索**：按文件名和正文内容跨文档搜索，`Ctrl + K` 可快速唤起。
- **自动保存**：文档内容保存到浏览器 IndexedDB。
- **智能命名**：根据 Markdown 标题或正文内容生成文件名，导入文件同样使用内容识别命名。
- **目录导航**：根据标题自动生成目录，点击跳转、当前标题高亮和目录栏自动跟随。
- **标题锚点**：预览区标题生成稳定 hash，便于定位和分享。
- **滚动同步**：编辑区与预览区按源码行号联动滚动。
- **编辑区折叠**：折叠编辑区专注预览，折叠后文件名和操作按钮移至预览区头部。
- **骨架屏加载**：数据初始化期间显示骨架屏，避免空白闪烁。
- **代码高亮**：基于 highlight.js 支持常用语言语法高亮。
- **文档统计**：实时显示行数、字数和字符数。
- **回到顶部**：预览区滚动较深时显示快捷返回按钮。
- **可调布局**：编辑区、预览区、目录区宽度都支持拖拽调整。
- **响应式界面**：桌面端左右布局，移动端上下布局。

## 技术栈

这个项目的技术选型很克制，主要由四部分组成：

- **Vue 3**：负责界面组件、状态响应和组合式逻辑封装。
- **Vite**：负责开发服务器、构建和静态资源处理。
- **marked**：负责 Markdown 解析。
- **highlight.js**：负责代码块语法高亮。

项目没有引入复杂的状态管理库，也没有后端服务。对于一个偏本地化的小工具来说，Vue 的响应式系统、组合式函数和浏览器原生能力已经足够。

## 项目结构

项目结构按照「组件负责界面，composable 负责行为」的思路组织：

```text
src/
├── assets/                     # SVG 图标（新建、清除、导入、导出、折叠/展开等）
├── components/
│   ├── AppToolbar.vue          # 顶部工具栏 + 搜索入口
│   ├── ContentViewSkeleton.vue # 加载骨架屏
│   ├── DocumentSearch.vue      # 跨文档搜索弹窗
│   ├── FileSwitcher.vue        # 文档切换下拉
│   ├── MarkdownEditor.vue      # Markdown 编辑区
│   ├── MarkdownPreview.vue     # Markdown 预览区
│   ├── PanelToolbar.vue        # 共享工具栏（文件名 + 操作按钮）
│   ├── ResizeDivider.vue       # 面板拖拽分割条
│   └── TableOfContents.vue     # 目录导航
├── composables/
│   ├── useDocumentExport.js    # Markdown / PDF 导出
│   ├── useHeadingNavigation.js # 标题 hash 导航
│   ├── useLocalStoragePreference.js # 用户偏好（折叠状态）持久化
│   ├── useMarkdownDocuments.js # 多文档状态 + IndexedDB 持久化
│   ├── useMarkdownRenderer.js  # Markdown 解析渲染
│   ├── usePaneResize.js        # 面板宽度拖拽
│   ├── useScrollSync.js        # 编辑/预览滚动同步
│   └── useTocResize.js         # 目录宽度拖拽
├── constants/                  # 编辑器常量
├── utils/                      # 通用工具函数
├── App.vue                     # 应用主界面
└── main.js                     # 应用入口
```

主界面 `App.vue` 负责把这些能力组装起来：文档状态来自 `useMarkdownDocuments`，渲染结果来自 `useMarkdownRenderer`，搜索入口由 `DocumentSearch` 放在顶部工具栏中，布局拖拽来自 `usePaneResize` 和 `useTocResize`，滚动同步来自 `useScrollSync`，导出能力来自 `useDocumentExport`，标题导航来自 `useHeadingNavigation`。

这种拆法的好处是，每个复杂行为都有清晰边界。比如后续想替换 Markdown 解析器，只需要集中调整 `useMarkdownRenderer`；想优化滚动同步，也不用改编辑器和预览组件的模板。

## Markdown 渲染：从文本到可导航 HTML

Markdown 渲染是整个工具的核心。项目中使用 `marked` 先把 Markdown 文本解析成 token，再通过自定义 renderer 输出 HTML。

这里没有直接使用默认渲染结果，而是在渲染过程中做了几件额外的事：

1. 为标题生成唯一 id（重复标题自动追加序号避免冲突）。
2. 收集标题信息，生成右侧目录。
3. 为标题添加 `#` 锚点链接，hover 时显示。
4. 为块级元素标记源码行号 `data-source-line`。
5. 对代码块调用 highlight.js 做语法高亮。

标题 `#` 锚点使用了 `float: left; margin-left: -1.1em` 的技巧，将 `#` 悬挂在标题文字左侧，不占用行内宽度，确保标题文字与其他内容左侧对齐。hover 标题时 `#` 淡入，点击可复制 hash 链接。

目录数据在标题渲染时同步收集：

```js
toc.push({
    id,
    title,
    level: token.depth,
    sourceLine: token.sourceLine
})
```

这样预览 HTML 和目录数据都来自同一轮解析，天然保持一致。

## 编辑区折叠与动画

编辑区折叠是一个实用的专注模式。点击编辑器右上角的 `<` 按钮，编辑区平滑收起，预览区扩展至全宽，适合在长文档中专心阅读。

折叠状态通过 `useLocalStoragePreference` 持久化到 `localStorage`，刷新后保持。折叠后，文件名切换（`FileSwitcher`）和操作按钮（导入、导出 Markdown、导出 PDF、展开按钮）统一移至预览区头部，通过共享组件 `PanelToolbar` 实现，避免编辑器与预览区的代码重复。

动画实现上，桌面端使用 `width` 过渡，移动端切换到 `height` 过渡以适配上下布局。关键优化：

- 拖拽 resize 时通过 `.is-resizing` class 动态关闭过渡，避免拖拽产生延迟。
- 内容区添加 `contain: layout`，将重排范围限制在布局边界内，长文档折叠动画不掉帧。
- 展开时用 `focus({ preventScroll: true })` 防止浏览器自动滚动到光标位置。

## 滚动同步：用源码行号连接编辑区和预览区

Markdown 编辑器的滚动同步并不像普通页面那样简单。原因是 Markdown 源码和渲染后的 HTML 高度并不一一对应：一个代码块、一张图片、一个表格都可能改变视觉高度。

MarkView 的处理方式是：在解析 Markdown token 时，给块级元素记录它在源码中的起始行号，并输出到 HTML 的 `data-source-line` 属性中。预览区渲染后，就可以拿到这些带行号的块级元素：

```text
编辑区第 N 行
    ↓
找到预览区中最接近 N 行的块级元素
    ↓
按相邻块之间的比例计算预览滚动位置
```

反过来，当用户滚动预览区时，也可以根据当前视口顶部附近的块级元素推算源码行号，再滚动编辑区。`useScrollSync` 里区分了用户滚动和程序滚动，避免两个区域互相触发造成循环。

预览区滚动时还会顺手更新两个辅助状态：目录高亮和「回到顶部」按钮显示。

## 多文档与自动保存

MarkView 不依赖服务端，所有文档数据都保存在浏览器 IndexedDB 中。文档状态大致包含：

```js
{
    activeId: '当前文档 id',
    files: [
        {
            id: '文档 id',
            name: '文档名.md',
            content: 'Markdown 内容',
            updatedAt: 1720000000000,
        },
    ],
}
```

每次用户编辑内容时，当前文档会立即更新响应式状态；随后通过防抖延迟保存，避免每输入一个字符都写入 IndexedDB。

文档名会根据内容自动生成：优先取 Markdown 一级标题，如果没有标题就取正文第一段有效内容，仍为空则使用默认名称。导入文件同样走这套逻辑——不再保留原始文件名，统一从内容生成，保持文档列表命名风格一致。

## 文件导入与导出

导入入口在 `PanelToolbar` 工具栏里，底层是一个隐藏的 file input。它支持一次选择多个 `.md`、`.markdown` 或文本文件：

```text
选择文件 → 读取 file.text() → 创建文档写入工作区 → 切换到导入后的文档
```

导出则提供两种格式：Markdown（下载 `.md` 文件）和 PDF（通过浏览器打印生成）。Markdown 导出时，文件名优先使用当前文档名；PDF 导出会隐藏界面中的工具栏、面板头部等非内容元素，只输出渲染后的正文。

## 跨文档搜索：从关键词到精确定位

当文档数量变多后，单靠文件名切换并不够。MarkView 在顶部工具栏里提供了搜索入口，支持用 `Ctrl + K` 聚焦搜索框，并在当前浏览器保存的所有文档中检索关键词。

搜索结果主要来自两类匹配：

- **文件名匹配**：如果文件名包含关键词，结果会标记为「文件名」。
- **正文匹配**：按行扫描 Markdown 内容，命中后展示所在文件、行号和上下文片段。

结果排序会优先展示当前文档中的匹配项，其次展示文件名命中，再按照文档顺序和源码行号排列。选择搜索结果后，主界面先切换到对应文档，再让编辑区聚焦到目标行，并让预览区滚动到相同源码行附近。展开和折叠状态下定位行为一致——折叠时直接定位预览区，展开时编辑区高亮 + 两端同步滚动。

## 可调布局与响应式适配

桌面端的 MarkView 是典型的写作工作台：左侧编辑，中间预览，右侧目录。编辑区和预览区之间有拖拽分隔条，目录区也可以拖拽调整宽度。

布局拖拽主要依赖 pointer 事件：pointerdown 进入拖拽、pointermove 计算新宽度（限制最小/最大值）、pointerup 退出并清理。拖拽时面板不触发 CSS `width` 过渡（通过 `is-resizing` class 禁用），保证即时响应。

响应式方面，窗口宽度 ≤ 1120px 时目录宽度缩小，≤ 900px 时目录隐藏，≤ 768px 时切换为上下布局。移动端的折叠同样适配——编辑区纵向收缩为 0，预览区撑满全高。

## 构建与部署

项目使用 Vite 构建，常用命令如下：

```bash
pnpm install
pnpm dev
pnpm build
pnpm preview
```

开发环境默认运行在 `http://localhost:3001/`。生产环境通过 `.env.production` 配置 Vite 的 base 路径：

```env
VITE_APP_PATH=/markview/
```

适合部署到 Gitee Pages、GitHub Pages 等静态站点服务。如果仓库名或部署路径变化，修改 `VITE_APP_PATH` 即可。

## 可以继续优化的方向

MarkView 目前已经覆盖了 Markdown 写作的基础闭环，但仍然有不少可以继续演进的方向：

- 支持批量导出或打包备份整个工作区。
- 增加主题切换，例如浅色、深色、护眼模式。
- 增加更多 Markdown 扩展能力，例如 Mermaid 图表、数学公式、脚注。
- 完善 IndexedDB 上的数据版本迁移和导入导出能力。
- 增加 PWA 支持，让工具更接近本地应用体验。

## 总结

MarkView 是一个小而完整的前端工具项目。它的重点不在于技术栈有多复杂，而在于把 Markdown 写作过程中的几个真实痛点串起来：实时预览、目录导航、全文搜索、滚动同步、编辑区折叠、多文档管理、文件导入导出和本地保存。

从工程实现上看，这个项目也很适合作为 Vue 3 组合式 API 的练习案例。组件只负责表达界面，复杂行为沉淀到 composables 中，既方便阅读，也方便后续扩展。

如果你也经常写 Markdown，不妨试试这个项目，或者基于它继续改造成自己的写作工具。

源码地址：https://gitee.com/acheding/markview
在线体验：https://acheding.gitee.io/markview/

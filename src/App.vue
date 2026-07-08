<template>
    <div class="app-container">
        <!-- 顶栏 -->
        <header class="toolbar">
            <div class="toolbar-left">
                <span class="logo">📝</span>
                <span class="title">Markdown 预览</span>
            </div>
            <div class="toolbar-right">
                <span class="stat">行数 <strong>{{ lineCount }}</strong></span>
                <span class="stat">字数 <strong>{{ wordCount }}</strong></span>
                <span class="stat">字符 <strong>{{ charCount }}</strong></span>
                <span class="save-status">💾 {{ saveStatus }}</span>
            </div>
        </header>

        <!-- 主体：左右两栏 -->
        <main class="main-panel">
            <!-- 左栏：编辑器 -->
            <section class="editor-panel">
                <div class="panel-header">
                    <span class="panel-label">✏️ 编辑</span>
                    <button class="btn-clear" @click="clearContent" title="清空内容">清空</button>
                </div>
                <textarea
                    ref="editorRef"
                    class="editor-textarea"
                    v-model="markdownContent"
                    spellcheck="false"
                    placeholder="在此输入 Markdown 内容..."
                ></textarea>
            </section>

            <!-- 分隔条（可拖拽） -->
            <div
                class="divider"
                @mousedown="startResize"
                :style="{ cursor: isResizing ? 'col-resize' : 'col-resize' }"
            >
                <div class="divider-handle"></div>
            </div>

            <!-- 右栏：预览 -->
            <section class="preview-panel" :style="{ width: previewWidth + '%' }">
                <div class="panel-header">
                    <span class="panel-label">👁️ 预览</span>
                    <span class="panel-hint">实时渲染</span>
                </div>
                <div
                    class="preview-content"
                    v-html="renderedHtml"
                ></div>
            </section>
        </main>
    </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick, onBeforeUnmount } from 'vue'
import { marked } from 'marked'
import hljs from 'highlight.js'

// ---------- 配置 marked ----------
marked.use({
    gfm: true,
    breaks: true,
    highlight: (code, lang) => {
        if (lang && hljs.getLanguage(lang)) {
            try {
                return hljs.highlight(code, { language: lang }).value
            } catch (_) {}
        }
        try {
            return hljs.highlightAuto(code).value
        } catch (_) {
            return code
        }
    },
})

// ---------- localStorage 键名 ----------
const STORAGE_KEY = 'markdown-preview-content'

// ---------- 默认内容 ----------
const defaultContent = `# 欢迎使用 Markdown 实时预览工具

这是一个基于 **Vue3** + **Vite** 构建的 Markdown 编辑器，左侧编辑，右侧实时预览。

---

## 基本语法示例

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

\`\`\`javascript
// 带语法高亮的代码块
function greet(name) {
    console.log(\`你好，\${name}！\`)
    return \`👋 欢迎 \${name}\`
}

greet('Vue3 开发者')
\`\`\`

\`\`\`python
# Python 示例
def fibonacci(n):
    a, b = 0, 1
    for _ in range(n):
        yield a
        a, b = b, a + b

print(list(fibonacci(10)))
\`\`\`

### 4. 表格

| 名称 | 类型 | 描述 |
|------|------|------|
| Vue  | 框架 | 渐进式 JavaScript 框架 |
| Vite | 构建工具 | 下一代前端构建工具 |
| Markdown | 标记语言 | 轻量级标记语言 |

### 5. 引用

> 技术不在于复杂，而在于优雅地解决问题。
> —— 某位开发者

### 6. 链接 & 图片

[访问 Vue 官网](https://vuejs.org/)

![Vue Logo](https://vuejs.org/images/logo.png)

### 7. 其他样式

- **粗体文字**
- *斜体文字*
- ~~删除线~~
- \`行内代码\`

---

✨ 试试在左侧编辑区修改内容，右侧会实时更新！
`

// ---------- 响应式状态 ----------
const markdownContent = ref('')
const editorRef = ref(null)
const isResizing = ref(false)
const leftWidth = ref(50)
const saveStatus = ref('已自动保存') // 保存状态提示

const previewWidth = computed(() => 100 - leftWidth.value)

// ---------- 统计 ----------
const lineCount = computed(() => {
    const text = markdownContent.value
    if (!text) return 0
    return text.split('\n').length
})

const wordCount = computed(() => {
    const text = markdownContent.value
    if (!text) return 0
    const words = text.match(/[\u4e00-\u9fa5]|[a-zA-Z]+(?:['’][a-zA-Z]+)?/g)
    return words ? words.length : 0
})

const charCount = computed(() => markdownContent.value.length)

// ---------- 渲染 ----------
const renderedHtml = computed(() => {
    if (!markdownContent.value) {
        return `<div class="empty-hint">✨ 在左侧编辑区输入 Markdown，右侧将实时预览</div>`
    }
    try {
        return marked.parse(markdownContent.value)
    } catch (err) {
        return `<div class="error-hint">⚠️ 解析出错：${err.message}</div>`
    }
})

// ---------- 保存到 localStorage ----------
const saveToStorage = (content) => {
    try {
        localStorage.setItem(STORAGE_KEY, content)
        saveStatus.value = '已自动保存'
    } catch (e) {
        saveStatus.value = '保存失败'
        console.warn('localStorage 写入失败:', e)
    }
}

// ---------- 从 localStorage 恢复 ----------
const loadFromStorage = () => {
    try {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved !== null && saved !== undefined) {
            return saved
        }
    } catch (e) {
        console.warn('localStorage 读取失败:', e)
    }
    return null
}

// ---------- 初始化内容 ----------
const initContent = () => {
    const saved = loadFromStorage()
    if (saved !== null) {
        markdownContent.value = saved
    } else {
        markdownContent.value = defaultContent
        // 首次使用时也保存一下，方便下次读取
        saveToStorage(defaultContent)
    }
}

// ---------- 监听内容变化，自动保存 ----------
watch(markdownContent, (newVal) => {
    saveToStorage(newVal)
}, { immediate: false })

// ---------- 清空 ----------
const clearContent = () => {
    if (confirm('确定要清空所有内容吗？')) {
        markdownContent.value = ''
        nextTick(() => {
            editorRef.value?.focus()
        })
    }
}

// ---------- 拖拽 ----------
const startResize = (e) => {
    isResizing.value = true
    document.addEventListener('mousemove', onResize)
    document.addEventListener('mouseup', stopResize)
    document.body.style.userSelect = 'none'
}

const onResize = (e) => {
    if (!isResizing.value) return
    const container = document.querySelector('.main-panel')
    if (!container) return
    const rect = container.getBoundingClientRect()
    const containerWidth = rect.width
    let percent = ((e.clientX - rect.left) / containerWidth) * 100
    percent = Math.min(Math.max(percent, 20), 80)
    leftWidth.value = percent
}

const stopResize = () => {
    isResizing.value = false
    document.removeEventListener('mousemove', onResize)
    document.removeEventListener('mouseup', stopResize)
    document.body.style.userSelect = ''
}

onBeforeUnmount(() => {
    document.removeEventListener('mousemove', onResize)
    document.removeEventListener('mouseup', stopResize)
})

// ---------- 快捷键 ----------
const handleKeydown = (e) => {
    if (e.ctrlKey && e.shiftKey && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault()
        clearContent()
    }
}

onMounted(() => {
    initContent()                // 加载或初始化内容
    editorRef.value?.focus()
    document.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
    document.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
/* ---------- 整体布局 ---------- */
.app-container {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: #f6f8fa;
}

/* ---------- 顶栏 ---------- */
.toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 24px;
    height: 52px;
    background: #ffffff;
    border-bottom: 1px solid #e1e4e8;
    flex-shrink: 0;
    user-select: none;
}

.toolbar-left {
    display: flex;
    align-items: center;
    gap: 10px;
}

.logo {
    font-size: 22px;
    line-height: 1;
}

.title {
    font-size: 16px;
    font-weight: 600;
    color: #24292e;
}

.toolbar-right {
    display: flex;
    align-items: center;
    gap: 20px;
    font-size: 13px;
    color: #57606a;
}

.stat {
    display: inline-flex;
    align-items: center;
    gap: 4px;
}

.stat strong {
    color: #24292e;
    font-weight: 600;
    min-width: 24px;
    text-align: center;
}

.save-status {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: #2da44e;
    font-weight: 500;
    font-size: 12px;
    background: #dafbe1;
    padding: 2px 10px;
    border-radius: 12px;
    transition: all 0.2s;
}

/* ---------- 主体 ---------- */
.main-panel {
    display: flex;
    flex: 1;
    min-height: 0;
    position: relative;
}

/* ---------- 左栏 / 右栏 ---------- */
.editor-panel,
.preview-panel {
    display: flex;
    flex-direction: column;
    background: #ffffff;
    overflow: hidden;
}

.editor-panel {
    width: v-bind('leftWidth + "%"');
    min-width: 20%;
    border-right: 1px solid #e1e4e8;
}

.preview-panel {
    width: v-bind('previewWidth + "%"');
    min-width: 20%;
    background: #ffffff;
}

.panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 16px;
    height: 36px;
    background: #fafbfc;
    border-bottom: 1px solid #e1e4e8;
    flex-shrink: 0;
    font-size: 13px;
    color: #57606a;
    user-select: none;
}

.panel-label {
    font-weight: 500;
    color: #24292e;
}

.panel-hint {
    font-size: 12px;
    color: #8b949e;
}

.btn-clear {
    padding: 2px 12px;
    font-size: 12px;
    color: #57606a;
    background: transparent;
    border: 1px solid #d0d7de;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s;
}

.btn-clear:hover {
    background: #f6f8fa;
    border-color: #b0b8c0;
    color: #24292e;
}

.btn-clear:active {
    transform: scale(0.96);
}

/* ---------- 编辑器 ---------- */
.editor-textarea {
    flex: 1;
    padding: 16px 20px;
    font-family: 'SF Mono', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace;
    font-size: 14px;
    line-height: 1.7;
    color: #24292e;
    background: #ffffff;
    border: none;
    outline: none;
    resize: none;
    tab-size: 2;
    -moz-tab-size: 2;
    white-space: pre-wrap;
    word-wrap: break-word;
    overflow-y: auto;
}

.editor-textarea::placeholder {
    color: #b0b8c0;
    font-style: italic;
}

/* ---------- 预览区 ---------- */
.preview-content {
    flex: 1;
    padding: 16px 24px;
    overflow-y: auto;
    background: #ffffff;
    font-size: 15px;
    line-height: 1.8;
    color: #24292e;
}

/* ---------- 预览区 Markdown 样式 ---------- */
.preview-content :deep(h1) {
    font-size: 28px;
    font-weight: 700;
    margin: 20px 0 12px 0;
    padding-bottom: 8px;
    border-bottom: 2px solid #e1e4e8;
}

.preview-content :deep(h2) {
    font-size: 22px;
    font-weight: 600;
    margin: 18px 0 10px 0;
    padding-bottom: 6px;
    border-bottom: 1px solid #e1e4e8;
}

.preview-content :deep(h3) {
    font-size: 18px;
    font-weight: 600;
    margin: 16px 0 8px 0;
}

.preview-content :deep(h4),
.preview-content :deep(h5),
.preview-content :deep(h6) {
    font-weight: 600;
    margin: 14px 0 6px 0;
}

.preview-content :deep(p) {
    margin: 10px 0;
}

.preview-content :deep(ul),
.preview-content :deep(ol) {
    padding-left: 28px;
    margin: 8px 0;
}

.preview-content :deep(li) {
    margin: 3px 0;
}

.preview-content :deep(li > ul),
.preview-content :deep(li > ol) {
    margin: 2px 0;
}

.preview-content :deep(blockquote) {
    margin: 12px 0;
    padding: 8px 16px;
    border-left: 4px solid #d0d7de;
    background: #f6f8fa;
    color: #57606a;
}

.preview-content :deep(blockquote p) {
    margin: 4px 0;
}

.preview-content :deep(code) {
    padding: 2px 6px;
    font-size: 0.9em;
    background: #f6f8fa;
    border-radius: 4px;
    font-family: 'SF Mono', 'JetBrains Mono', 'Fira Code', monospace;
    color: #e83e8c;
}

.preview-content :deep(pre) {
    margin: 12px 0;
    padding: 14px 18px;
    background: #f6f8fa;
    border-radius: 8px;
    overflow-x: auto;
    font-size: 13px;
    line-height: 1.6;
}

.preview-content :deep(pre code) {
    padding: 0;
    background: transparent;
    font-size: inherit;
    color: inherit;
    border-radius: 0;
}

.preview-content :deep(table) {
    border-collapse: collapse;
    width: 100%;
    margin: 12px 0;
    font-size: 14px;
}

.preview-content :deep(th),
.preview-content :deep(td) {
    border: 1px solid #d0d7de;
    padding: 8px 14px;
    text-align: left;
}

.preview-content :deep(th) {
    background: #f6f8fa;
    font-weight: 600;
}

.preview-content :deep(tr:nth-child(even)) {
    background: #fafbfc;
}

.preview-content :deep(a) {
    color: #0969da;
    text-decoration: none;
}

.preview-content :deep(a:hover) {
    text-decoration: underline;
}

.preview-content :deep(img) {
    max-width: 100%;
    height: auto;
    border-radius: 6px;
    margin: 8px 0;
}

.preview-content :deep(hr) {
    border: none;
    border-top: 2px solid #e1e4e8;
    margin: 20px 0;
}

.preview-content :deep(strong) {
    font-weight: 700;
}

.preview-content :deep(em) {
    font-style: italic;
}

.preview-content :deep(del) {
    text-decoration: line-through;
    color: #8b949e;
}

/* 空状态 & 错误 */
.preview-content :deep(.empty-hint) {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    font-size: 16px;
    color: #8b949e;
    text-align: center;
    padding: 40px;
}

.preview-content :deep(.error-hint) {
    color: #cf222e;
    background: #ffebe9;
    padding: 16px 20px;
    border-radius: 8px;
    border-left: 4px solid #cf222e;
}

/* ---------- 分隔条 ---------- */
.divider {
    flex-shrink: 0;
    width: 4px;
    background: #e1e4e8;
    cursor: col-resize;
    position: relative;
    z-index: 10;
    transition: background 0.15s;
    display: flex;
    align-items: center;
    justify-content: center;
}

.divider:hover,
.divider:active {
    background: #0969da;
}

.divider-handle {
    width: 2px;
    height: 40px;
    background: #d0d7de;
    border-radius: 2px;
    transition: background 0.15s;
}

.divider:hover .divider-handle,
.divider:active .divider-handle {
    background: #ffffff;
}

/* ---------- 响应式 ---------- */
@media (max-width: 768px) {
    .main-panel {
        flex-direction: column;
    }

    .editor-panel {
        width: 100% !important;
        height: 50%;
        border-right: none;
        border-bottom: 1px solid #e1e4e8;
    }

    .preview-panel {
        width: 100% !important;
        height: 50%;
    }

    .divider {
        width: 100%;
        height: 4px;
        cursor: row-resize;
    }

    .divider-handle {
        width: 40px;
        height: 2px;
    }

    .toolbar {
        padding: 0 16px;
        height: 44px;
        flex-wrap: wrap;
        gap: 4px;
    }

    .toolbar-right {
        gap: 12px;
        font-size: 12px;
    }

    .title {
        font-size: 14px;
    }

    .panel-header {
        padding: 4px 12px;
        height: 32px;
        font-size: 12px;
    }

    .editor-textarea {
        padding: 12px 16px;
        font-size: 13px;
    }

    .preview-content {
        padding: 12px 16px;
        font-size: 14px;
    }
}
</style>

export const LEGACY_STORAGE_KEY = 'markdown-preview-content'
export const DOCUMENTS_STORAGE_KEY = 'markdown-preview-documents'
export const DEFAULT_DOCUMENT_NAME = '新文档.md'

export const DEFAULT_CONTENT = `# 欢迎使用 Markdown 实时预览工具

这是一个基于 **Vue 3** + **Vite** 构建的 Markdown 编辑器，左侧编辑，右侧实时预览。

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
function greet(name) {
    console.log(\`你好，\${name}！\`)
    return \`欢迎 \${name}\`
}

greet('Vue 3 开发者')
\`\`\`

\`\`\`python
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
- \`行内代码\`

---

试试在左侧编辑区修改内容，右侧会实时更新。
`

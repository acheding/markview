import { describe, expect, it } from 'vitest'
import { renderMarkdown } from './renderMarkdown.js'

describe('renderMarkdown', () => {
    it('builds heading ids and toc data from markdown headings', async () => {
        const { html, toc } = await renderMarkdown('# 安装\n\n## 安装')

        expect(html).toContain(
            '<h1 id="安装" data-source-line="1"><a class="heading-anchor" href="#安装" aria-hidden="true">#</a>安装</h1>'
        )
        expect(html).toContain(
            '<h2 id="安装-1" data-source-line="3"><a class="heading-anchor" href="#安装-1" aria-hidden="true">#</a>安装</h2>'
        )
        expect(toc).toEqual([
            { id: '安装', title: '安装', level: 1, sourceLine: 1 },
            { id: '安装-1', title: '安装', level: 2, sourceLine: 3 }
        ])
    })

    it('escapes raw html instead of injecting it', async () => {
        const { html } = await renderMarkdown('<script>alert(1)</script>')

        expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
        expect(html).not.toContain('<script>')
    })

    it('drops unsafe link and image urls while preserving safe urls', async () => {
        const { html } = await renderMarkdown(
            [
                '[bad](javascript:alert(1))',
                '[ok](https://example.com)',
                '![bad](javascript:alert(1))',
                '![ok](data:image/png;base64,aGVsbG8=)'
            ].join('\n\n')
        )

        expect(html).not.toContain('javascript:')
        expect(html).toContain('<p data-source-line="1">bad</p>')
        expect(html).toContain('<a href="https://example.com" target="_blank" rel="noopener noreferrer">ok</a>')
        expect(html).toContain('<p data-source-line="5">bad</p>')
        expect(html).toContain('<img src="data:image/png;base64,aGVsbG8=" alt="ok">')
    })

    it('shows an empty hint for blank input', async () => {
        expect((await renderMarkdown('   ')).html).toContain('empty-hint')
    })

    it('keeps the checkbox inline with the text in a tight task list', async () => {
        const { html } = await renderMarkdown('- [ ] 待办\n- [x] 完成')

        // tight 列表项不应被包进块级 <p>（否则复选框会被挤到单独一行）。
        expect(html).toContain('<li><input data-task-line="1" type="checkbox"> 待办</li>')
        expect(html).toContain('<li><input checked="" data-task-line="2" type="checkbox"> 完成</li>')
        expect(html).not.toContain('<li><input data-task-line="1" type="checkbox"> <p>')
    })

    it('merges the checkbox into the first paragraph of a loose task list item', async () => {
        const { html } = await renderMarkdown('- [ ] 待办\n\n- [x] 完成')

        // loose 列表项保留 <p>，但复选框需并入首段内部以保持同行。
        expect(html).toContain('<li><p><input data-task-line="1" type="checkbox"> 待办</p>')
        expect(html).toContain('<li><p><input checked="" data-task-line="3" type="checkbox"> 完成</p>')
    })

    it('annotates task lines across continuation lines and nested lists', async () => {
        const source = [
            '前文',
            '',
            '- [ ] 任务A',
            '  说明续行',
            '  - [x] 子任务B',
            '  - [ ] 子任务C',
            '- [ ] 任务D'
        ].join('\n')
        const { html } = await renderMarkdown(source)

        // 多行列表项与嵌套列表（raw 被 marked 去缩进）都应定位到正确源码行。
        expect(html).toContain('data-task-line="3"')
        expect(html).toContain('data-task-line="5"')
        expect(html).toContain('data-task-line="6"')
        expect(html).toContain('data-task-line="7"')
        expect(html).not.toContain('disabled=""')
    })

    it('falls back to a disabled checkbox when the task line cannot be located', async () => {
        // 引用块内的任务列表：其 list token 不经过顶层行标注，退回禁用态（只展示不交互）。
        const { html } = await renderMarkdown('> - [ ] 引用里的任务')

        expect(html).toContain('disabled="" type="checkbox"')
        expect(html).not.toContain('data-task-line')
    })

    it('does not wrap tight plain list items in paragraphs', async () => {
        const { html } = await renderMarkdown('- 甲\n- 乙')

        expect(html).toContain('<li>甲</li>')
        expect(html).toContain('<li>乙</li>')
    })

    it('renders inline and block math with KaTeX', async () => {
        const inline = (await renderMarkdown('质能方程 $E = mc^2$ 很短')).html
        expect(inline).toContain('class="katex"')
        expect(inline).not.toContain('$E = mc^2$')

        const block = (await renderMarkdown('$$\n\\frac{1}{2}\n$$')).html
        expect(block).toContain('katex-block')
        expect(block).toContain('katex-display')
    })

    it('does not treat currency amounts as inline math', async () => {
        // 闭 $ 左侧是空格、右侧接数字，均不满足行内公式定界规则，应原样保留。
        const { html } = await renderMarkdown('买 $100 和 $200 一共 $300')

        expect(html).not.toContain('class="katex"')
        expect(html).toContain('$100')
        expect(html).toContain('$200')
        expect(html).toContain('$300')
    })

    it('requires the opening $ to hug a non-space character', async () => {
        // 「$ x $」开定界符后是空格，不构成行内公式。
        const { html } = await renderMarkdown('区间 $ x $ 结束')

        expect(html).not.toContain('class="katex"')
    })

    it('keeps an escaped dollar sign as a literal character', async () => {
        // marked 内置 escape 先消费 \$，不会开启行内公式。
        const { html } = await renderMarkdown('单价 \\$5 起')

        expect(html).not.toContain('class="katex"')
        expect(html).toContain('$5')
    })

    it('renders leading yaml frontmatter as a metadata card, not markdown', async () => {
        const { html } = await renderMarkdown('---\nname: mp-verify\ndescription: 截图验证\n---\n\n# 正文')

        expect(html).toContain('<dl class="frontmatter" data-source-line="1">')
        expect(html).toContain('<dt class="frontmatter__key">name</dt><dd class="frontmatter__value">mp-verify</dd>')
        expect(html).toContain('<dd class="frontmatter__value">截图验证</dd>')
        // 不应退化成 marked 的分隔线 + setext 大标题
        expect(html).not.toContain('<hr')
        expect(html).not.toContain('mp-verify</h2>')
    })

    it('keeps body source lines aligned after stripping frontmatter', async () => {
        const { html, toc } = await renderMarkdown('---\nname: x\n---\n\n# 标题')

        // frontmatter 占 4 行，正文标题在第 5 行——data-source-line 必须保持原文行号，滚动同步才不失准。
        expect(html).toContain('<h1 id="标题" data-source-line="5">')
        expect(toc).toEqual([{ id: '标题', title: '标题', level: 1, sourceLine: 5 }])
    })

    it('treats a divider-wrapped block as normal markdown, not frontmatter', async () => {
        // 解析不出键值对（无 `key: value`）时不当 frontmatter，交回正常渲染。
        const { html } = await renderMarkdown('---\n只是一段文字\n---')

        expect(html).not.toContain('class="frontmatter"')
    })

    it('hides html comments instead of showing them as literal text', async () => {
        const { html } = await renderMarkdown('<!-- 开篇注释 -->\n\n# 正文')

        expect(html).not.toContain('开篇注释')
        expect(html).not.toContain('&lt;!--')
        expect(html).toContain('<h1 id="正文"')
    })

    it('emits a mermaid placeholder instead of highlighting mermaid code blocks', async () => {
        const { html } = await renderMarkdown('```mermaid\nflowchart TD\n  A --> B\n```')

        expect(html).toContain('<div class="mermaid-block"')
        expect(html).toContain('flowchart TD')
        // 不应作为普通代码块高亮
        expect(html).not.toContain('<pre')
        expect(html).not.toContain('class="hljs')
    })
})

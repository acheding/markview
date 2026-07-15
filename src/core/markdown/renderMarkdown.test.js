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
        expect(html).toContain('<a href="https://example.com">ok</a>')
        expect(html).toContain('<p data-source-line="5">bad</p>')
        expect(html).toContain('<img src="data:image/png;base64,aGVsbG8=" alt="ok">')
    })

    it('shows an empty hint for blank input', async () => {
        expect((await renderMarkdown('   ')).html).toContain('empty-hint')
    })

    it('keeps the checkbox inline with the text in a tight task list', async () => {
        const { html } = await renderMarkdown('- [ ] 待办\n- [x] 完成')

        // tight 列表项不应被包进块级 <p>（否则复选框会被挤到单独一行）。
        expect(html).toContain('<li><input disabled="" type="checkbox"> 待办</li>')
        expect(html).toContain('<li><input checked="" disabled="" type="checkbox"> 完成</li>')
        expect(html).not.toContain('<li><input disabled="" type="checkbox"> <p>')
    })

    it('merges the checkbox into the first paragraph of a loose task list item', async () => {
        const { html } = await renderMarkdown('- [ ] 待办\n\n- [x] 完成')

        // loose 列表项保留 <p>，但复选框需并入首段内部以保持同行。
        expect(html).toContain('<li><p><input disabled="" type="checkbox"> 待办</p>')
        expect(html).toContain('<li><p><input checked="" disabled="" type="checkbox"> 完成</p>')
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

    it('emits a mermaid placeholder instead of highlighting mermaid code blocks', async () => {
        const { html } = await renderMarkdown('```mermaid\nflowchart TD\n  A --> B\n```')

        expect(html).toContain('<div class="mermaid-block"')
        expect(html).toContain('flowchart TD')
        // 不应作为普通代码块高亮
        expect(html).not.toContain('<pre')
        expect(html).not.toContain('class="hljs')
    })
})

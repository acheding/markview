import { ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { useMarkdownRenderer } from './useMarkdownRenderer.js'

const render = (source) => useMarkdownRenderer(ref(source)).renderedHtml.value

describe('useMarkdownRenderer', () => {
    it('builds heading ids and toc data from markdown headings', () => {
        const source = ref('# 安装\n\n## 安装')
        const { renderedHtml, toc } = useMarkdownRenderer(source)

        expect(renderedHtml.value).toContain(
            '<h1 id="安装" data-source-line="1"><a class="heading-anchor" href="#安装" aria-hidden="true">#</a>安装</h1>'
        )
        expect(renderedHtml.value).toContain(
            '<h2 id="安装-1" data-source-line="3"><a class="heading-anchor" href="#安装-1" aria-hidden="true">#</a>安装</h2>'
        )
        expect(toc.value).toEqual([
            { id: '安装', title: '安装', level: 1, sourceLine: 1 },
            { id: '安装-1', title: '安装', level: 2, sourceLine: 3 }
        ])
    })

    it('escapes raw html instead of injecting it', () => {
        const html = render('<script>alert(1)</script>')

        expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
        expect(html).not.toContain('<script>')
    })

    it('drops unsafe link and image urls while preserving safe urls', () => {
        const html = render(
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
})

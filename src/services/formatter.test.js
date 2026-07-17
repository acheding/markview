import { describe, expect, it } from 'vitest'
import { formatMarkdown } from './formatter.js'

describe('formatMarkdown', () => {
    it('对齐表格并统一列表符号', async () => {
        const source = '| 名称 | 值 |\n|---|-----|\n| a | 1 |\n\n* 甲\n* 乙\n'
        const { formatted } = await formatMarkdown(source)
        expect(formatted).toContain('| --- |')
        expect(formatted).toContain('- 甲')
        expect(formatted).toContain('- 乙')
    })

    it('格式化受支持语言的围栏代码块', async () => {
        const source = '```js\nconst a={x:1,y:  2}\n```\n'
        const { formatted } = await formatMarkdown(source)
        expect(formatted).toContain('const a = { x: 1, y: 2 };')
    })

    it('不认识的语言块（mermaid / python）原样保留', async () => {
        const mermaid = 'graph TD;A-->B;'
        const python = 'def f( x ):return x'
        const source = '```mermaid\n' + mermaid + '\n```\n\n```python\n' + python + '\n```\n'
        const { formatted } = await formatMarkdown(source)
        expect(formatted).toContain(mermaid)
        expect(formatted).toContain(python)
    })

    it('proseWrap preserve：超长中文段落不被折行', async () => {
        const paragraph =
            '这是一段特意写得很长的中文正文，长度远远超过八十个字符的默认打印宽度，格式化之后必须保持为完整的一行，不能被换行打断。'
        const { formatted } = await formatMarkdown(`# 标题\n\n${paragraph}\n`)
        expect(formatted).toContain(`\n${paragraph}\n`)
    })

    it('光标映射到格式化后的对应位置', async () => {
        const source = '* item\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\ntail\n'
        const { formatted, cursorOffset } = await formatMarkdown(source, source.indexOf('tail'))
        expect(formatted.slice(cursorOffset, cursorOffset + 4)).toBe('tail')
    })

    it('YAML front matter 可被格式化而不报错', async () => {
        const source = "---\ntitle:   'demo'\n---\n\n# hi\n"
        const { formatted } = await formatMarkdown(source)
        expect(formatted).toContain('title:')
        expect(formatted).toContain('# hi')
    })

    it('已符合格式的文本输出保持不变', async () => {
        const source = '# 标题\n\n- 甲\n- 乙\n'
        const { formatted } = await formatMarkdown(source)
        expect(formatted).toBe(source)
    })
})

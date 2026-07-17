import { describe, expect, it, vi } from 'vitest'
import { preparePreviewHtml } from './preparePreviewHtml.js'

const createTemplateHarness = (codes) => {
    const blocks = codes.map((code) => ({ textContent: code, innerHTML: code }))
    return {
        template: {
            content: { querySelectorAll: () => blocks },
            get innerHTML() {
                return blocks.map((block) => `<div class="mermaid-block">${block.innerHTML}</div>`).join('')
            }
        },
        blocks
    }
}

describe('preparePreviewHtml', () => {
    it('leaves HTML without Mermaid untouched', async () => {
        const createTemplateElement = vi.fn()

        await expect(preparePreviewHtml('<p>plain</p>', 'light', { createTemplateElement })).resolves.toBe(
            '<p>plain</p>'
        )
        expect(createTemplateElement).not.toHaveBeenCalled()
    })

    it('builds every Mermaid SVG off-screen before returning HTML', async () => {
        const { template } = createTemplateHarness(['flowchart TD', 'sequenceDiagram'])
        const renderSvg = vi.fn((code, theme) => Promise.resolve(`<svg data-theme="${theme}">${code}</svg>`))

        const html = await preparePreviewHtml('<div class="mermaid-block">source</div>', 'dark', {
            createTemplateElement: () => template,
            renderSvg
        })

        expect(renderSvg).toHaveBeenCalledTimes(2)
        expect(html).toContain('<svg data-theme="dark">flowchart TD</svg>')
        expect(html).toContain('<svg data-theme="dark">sequenceDiagram</svg>')
    })

    it('shows a waiting hint for empty Mermaid source instead of rendering an error', async () => {
        const { template } = createTemplateHarness(['', '   \n  '])
        const renderSvg = vi.fn()

        const html = await preparePreviewHtml('<div class="mermaid-block"></div>', 'light', {
            createTemplateElement: () => template,
            renderSvg
        })

        expect(renderSvg).not.toHaveBeenCalled()
        expect(html).not.toContain('mermaid-error')
        expect(html).toContain('class="mermaid-empty"')
    })

    it('treats unknown diagram type as waiting state instead of an error', async () => {
        const { template } = createTemplateHarness(['被未闭合围栏吞进来的正文段落'])
        const unknownTypeError = Object.assign(new Error('No diagram type detected matching given configuration'), {
            name: 'UnknownDiagramError'
        })

        const html = await preparePreviewHtml('<div class="mermaid-block">x</div>', 'light', {
            createTemplateElement: () => template,
            renderSvg: () => Promise.reject(unknownTypeError)
        })

        expect(html).not.toContain('mermaid-error')
        expect(html).toContain('class="mermaid-empty"')
    })

    it('contains a diagram error without rejecting the whole preview', async () => {
        const { template } = createTemplateHarness(['broken'])

        const html = await preparePreviewHtml('<div class="mermaid-block">broken</div>', 'light', {
            createTemplateElement: () => template,
            renderSvg: () => Promise.reject(new Error('<invalid>'))
        })

        expect(html).toContain('class="mermaid-error"')
        expect(html).toContain('&lt;invalid&gt;')
    })
})

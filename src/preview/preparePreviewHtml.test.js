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

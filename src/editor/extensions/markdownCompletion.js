const LINK_DESTINATION_PATTERN = /\]\(([^)\s]*)$/
const ANCHOR_VALID_FOR = /^#[^)\s]*$/
const DOCUMENT_VALID_FOR = /^(?:\.\/)?[^)\s]*$/

const anchorSection = { name: '当前文档锚点', rank: 0 }

const anchorOptions = (headings) =>
    headings.map((heading) => ({
        label: `#${heading.id}`,
        detail: `H${heading.level} · ${heading.title}`,
        type: 'text',
        section: anchorSection
    }))

const documentOptions = (documents) =>
    documents.map((document) => {
        const href = `./${encodeURI(document.name)}`
        return {
            label: href,
            displayLabel: document.name,
            detail: '工作区文档',
            apply: href,
            type: 'text'
        }
    })

export const createMarkdownCompletionSource = ({ getHeadings = () => [], getDocuments = () => [] } = {}) =>
    function markdownCompletionSource(context) {
        const line = context.state.doc.lineAt(context.pos)
        const beforeCursor = line.text.slice(0, context.pos - line.from)
        const match = beforeCursor.match(LINK_DESTINATION_PATTERN)
        if (!match) return null

        const destination = match[1]
        const completingAnchor = destination.startsWith('#')
        const options = completingAnchor ? anchorOptions(getHeadings()) : documentOptions(getDocuments())
        if (!options.length) return null

        return {
            from: context.pos - destination.length,
            options,
            validFor: completingAnchor ? ANCHOR_VALID_FOR : DOCUMENT_VALID_FOR
        }
    }

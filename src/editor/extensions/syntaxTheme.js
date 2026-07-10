import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'

const vitePressHighlightStyle = HighlightStyle.define([
    {
        tag: [tags.comment, tags.lineComment, tags.blockComment, tags.docComment],
        color: 'var(--color-syntax-comment)'
    },
    {
        tag: [
            tags.keyword,
            tags.controlKeyword,
            tags.definitionKeyword,
            tags.moduleKeyword,
            tags.modifier,
            tags.operatorKeyword
        ],
        color: 'var(--color-syntax-keyword)'
    },
    {
        tag: [tags.string, tags.docString, tags.character, tags.attributeValue, tags.regexp],
        color: 'var(--color-syntax-string)'
    },
    {
        tag: [tags.function(tags.variableName), tags.function(tags.propertyName), tags.className],
        color: 'var(--color-syntax-title)'
    },
    {
        tag: [tags.number, tags.bool, tags.null, tags.atom],
        color: 'var(--color-syntax-constant)'
    },
    {
        tag: [tags.typeName, tags.tagName],
        color: 'var(--color-syntax-type)'
    },
    {
        tag: [tags.meta, tags.documentMeta, tags.annotation, tags.processingInstruction],
        color: 'var(--color-syntax-meta)'
    },
    {
        tag: [tags.heading, tags.strong],
        color: 'var(--color-heading-strong)',
        fontWeight: '700'
    },
    {
        tag: [tags.link, tags.url],
        color: 'var(--color-blue)'
    },
    {
        tag: tags.emphasis,
        fontStyle: 'italic'
    }
])

export const vitePressSyntaxHighlighting = syntaxHighlighting(vitePressHighlightStyle)

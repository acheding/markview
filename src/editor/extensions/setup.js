import { autocompletion } from '@codemirror/autocomplete'
import { markdown } from '@codemirror/lang-markdown'
import { Compartment } from '@codemirror/state'
import { EditorView, highlightActiveLine, highlightActiveLineGutter, lineNumbers, placeholder } from '@codemirror/view'
import { minimalSetup } from 'codemirror'
import { markdownCodeLanguages } from './codeLanguages.js'
import { editorTheme } from './theme.js'
import { createImagePaste } from './imagePaste.js'
import { imageDataUrlFold, imageDataUrlFoldTheme } from './imageDataUrlFold.js'
import { languageCompletionExtensions } from './languageCompletions.js'
import { createMarkdownCompletionSource } from './markdownCompletion.js'
import { searchHighlightField } from './searchHighlight.js'
import { vitePressSyntaxHighlighting } from './syntaxTheme.js'
import { userIntentExtension } from './userIntent.js'

const PLACEHOLDER_TEXT = '在此输入 Markdown 内容...'

// 组装编辑器全部扩展。主题放进 Compartment，为将来的暗色主题热切换预留 reconfigure 能力。
export const createEditorExtensions = ({ onDocChanged, onUserIntent, onImageNotify, completion }) => {
    const themeCompartment = new Compartment()
    const markdownCompletionSource = createMarkdownCompletionSource(completion)
    const markdownSupport = markdown({ codeLanguages: markdownCodeLanguages })

    const extensions = [
        minimalSetup,
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        markdownSupport,
        markdownSupport.language.data.of({ autocomplete: markdownCompletionSource }),
        languageCompletionExtensions,
        autocompletion({ activateOnTyping: true, maxRenderedOptions: 40 }),
        vitePressSyntaxHighlighting,
        EditorView.lineWrapping,
        placeholder(PLACEHOLDER_TEXT),
        searchHighlightField,
        createImagePaste({ onNotify: onImageNotify }),
        imageDataUrlFold,
        imageDataUrlFoldTheme,
        themeCompartment.of(editorTheme),
        EditorView.contentAttributes.of({
            'aria-label': 'Markdown 编辑器',
            spellcheck: 'false'
        }),
        userIntentExtension({ onDocChanged, onUserIntent })
    ]

    return { extensions, themeCompartment }
}

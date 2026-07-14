import { autocompletion, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { indentWithTab } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { bracketMatching } from '@codemirror/language'
import { Compartment, Prec } from '@codemirror/state'
import {
    EditorView,
    highlightActiveLine,
    highlightActiveLineGutter,
    keymap,
    lineNumbers,
    placeholder
} from '@codemirror/view'
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
        // 括号 / 引号 / 反引号自动配对与匹配高亮，便于写链接 []()、行内代码 `` 等。
        closeBrackets(),
        bracketMatching(),
        // closeBrackets 的 Backspace（成对删除）需盖过 minimalSetup 的默认 Backspace，故提到高优先级。
        Prec.high(keymap.of(closeBracketsKeymap)),
        // Tab 缩进：优先级低于补全键位，补全弹出时 Tab 接受候选，否则缩进当前行 / 选区。
        keymap.of([indentWithTab]),
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

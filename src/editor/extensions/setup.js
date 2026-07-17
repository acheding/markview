import { autocompletion, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { indentWithTab } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { bracketMatching } from '@codemirror/language'
import { search, searchKeymap } from '@codemirror/search'
import { Compartment, EditorState, Prec } from '@codemirror/state'
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
import { markviewSearchPanel } from './searchPanel.js'
import { vitePressSyntaxHighlighting } from './syntaxTheme.js'
import { userIntentExtension } from './userIntent.js'

const PLACEHOLDER_TEXT = '在此输入 Markdown 内容...'

// @codemirror/search 无障碍播报与「跳转到行」对话框的文案汉化（键为库内英文原文）。
// 查找替换面板本身是自定义 DOM（searchPanel.js），界面文案直接写在那里，不走 phrases。
const SEARCH_PHRASES = {
    'current match': '当前匹配',
    'on line': '所在行',
    'replaced $ matches': '已替换 $ 处匹配',
    'replaced match on line $': '已替换第 $ 行的匹配',
    'Go to line': '跳转到行',
    go: '跳转'
}

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
        // 查找替换：自定义面板（含命中计数 / 出入场动画），悬浮于编辑区右上（placement 见面板与主题）。
        // Mod-F 从键位表剔除，统一走全局快捷键（createWorkspace 监听）：编辑器内外行为一致，
        // 且避免编辑器聚焦时键位与全局监听双重触发；保留 F3 / Mod-G 上下个、Mod-D 选中下一处等。
        search({ createPanel: markviewSearchPanel }),
        keymap.of(searchKeymap.filter((binding) => binding.key !== 'Mod-f')),
        EditorState.phrases.of(SEARCH_PHRASES),
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

import { cssCompletionSource, cssLanguage } from '@codemirror/lang-css'
import { htmlCompletionSource, htmlLanguage } from '@codemirror/lang-html'
import { javascript } from '@codemirror/lang-javascript'
import { globalCompletion, localCompletionSource, pythonLanguage } from '@codemirror/lang-python'

// Markdown 的嵌套代码解析只挂载语言 parser，不会自动带上各语言包的 support extension。
// 在顶层注册对应 language-data facet，补全仍只会在光标所在的嵌套语言中生效。
export const languageCompletionExtensions = [
    javascript({ typescript: true }).support,
    cssLanguage.data.of({ autocomplete: cssCompletionSource }),
    htmlLanguage.data.of({ autocomplete: htmlCompletionSource }),
    pythonLanguage.data.of({ autocomplete: localCompletionSource }),
    pythonLanguage.data.of({ autocomplete: globalCompletion })
]

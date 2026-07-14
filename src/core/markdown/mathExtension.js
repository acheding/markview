import katex from 'katex'
import { escapeHtml } from '../text.js'

// 用 KaTeX 把 LaTeX 渲染为 HTML（同步、纯字符串输出，无 DOM 副作用）。
const renderKatex = (tex, displayMode) => {
    try {
        return katex.renderToString(tex, { displayMode, throwOnError: false, output: 'html' })
    } catch (error) {
        return `<span class="katex-error" title="${escapeHtml(error.message)}">${escapeHtml(tex)}</span>`
    }
}

// 块级公式 $$...$$：独占成块，居中展示。
const blockMath = {
    name: 'blockMath',
    level: 'block',
    // 只认行首的 $$，避免把段落中行内代码 `$$` 误当块级公式起点而截断段落。
    start(src) {
        const match = /(^|\n)\$\$/.exec(src)
        return match ? match.index + match[1].length : undefined
    },
    tokenizer(src) {
        const match = /^\$\$([\s\S]+?)\$\$/.exec(src)
        if (!match) return undefined
        return { type: 'blockMath', raw: match[0], text: match[1].trim() }
    },
    renderer(token) {
        const sourceLine = Number.isFinite(token.sourceLine) ? ` data-source-line="${token.sourceLine}"` : ''
        return `<div class="katex-block"${sourceLine}>${renderKatex(token.text, true)}</div>`
    }
}

// 行内公式 $...$：不匹配 $$，内部不跨行、不含裸 $。
// 采用 Pandoc/GitHub 的定界规则规避货币误判（如「买 $100 和 $200」不应被当公式）：
//   1. 开 $ 右侧紧邻非空白        (?=\S)         —— 排除「$ 100」这类
//   2. 闭 $ 左侧紧邻非空白        [^$\n\s] 结尾  —— 「$100 和 $」的闭 $ 前是空格，不成立
//   3. 闭 $ 右侧不接数字          (?![$\d])      —— 「$5 到 $10」的 $10 不误开公式
// 内容首尾均须非空白，故用「(?=\S) + …以非空白结尾」表达，避免 lookbehind（旧版 Safari 不支持）。
// 转义 `\$` 无需在此处理：marked 内置的 escape tokenizer 会先消费它，落为字面 $。
const INLINE_MATH_RE = /^\$(?!\$)(?=\S)([^$\n]*[^$\n\s])\$(?![$\d])/

const inlineMath = {
    name: 'inlineMath',
    level: 'inline',
    start(src) {
        const index = src.indexOf('$')
        return index < 0 ? undefined : index
    },
    tokenizer(src) {
        const match = INLINE_MATH_RE.exec(src)
        if (!match) return undefined
        return { type: 'inlineMath', raw: match[0], text: match[1] }
    },
    renderer(token) {
        return renderKatex(token.text, false)
    }
}

// tokenizer 供 lexer 识别 $…$ / $$…$$；renderer 需并入 parser 的 per-call renderers
// （marked 静态 parser 传 options 会覆盖实例扩展，故 renderer 单独导出合并）。
export const mathExtensions = [blockMath, inlineMath]

export const mathRenderers = {
    blockMath: blockMath.renderer,
    inlineMath: inlineMath.renderer
}

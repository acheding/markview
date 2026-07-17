// 任务列表标记定位：在一行源码中找到列表符号后的 [ ] / [x]，给出状态字符的列区间。
// 预览区勾选回写用它把「行号」翻译成「该行上要改写的那个字符」，是回写安全性的唯一闸门：
// 行内容对不上（编辑后行号已漂移等）就返回 null，调用方放弃改写。

// 与 marked 的任务项识别对齐：无序（-/*/+）或有序（1. / 1)）列表符号，后跟 [ ]/[x]/[X] 和至少一个空白。
const TASK_MARKER_RE = /^\s*(?:[-*+]|\d+[.)])\s+\[([ xX])\]\s/

/**
 * @param {string} lineText 单行源码（不含换行）
 * @returns {{ from: number, to: number, checked: boolean } | null} 状态字符的列区间与当前勾选态
 */
export const findTaskMarker = (lineText) => {
    const match = TASK_MARKER_RE.exec(String(lineText ?? ''))
    if (!match) return null

    // 列表符号（-/*/+/数字.）里不含 [，匹配段中的第一个 [ 必是复选框左括号。
    const stateIndex = match[0].indexOf('[') + 1
    return { from: stateIndex, to: stateIndex + 1, checked: match[1] !== ' ' }
}

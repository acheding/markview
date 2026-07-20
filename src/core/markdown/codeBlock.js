// 围栏代码块的插入文本构造：纯字符串计算、不依赖编辑器，由 EditorController 组装成事务。

const FENCE = '```'

/**
 * 构造「插入围栏代码块」的文本与光标落点。
 * 光标停在语言标记位（``` 之后），可直接敲 json / js；选中的文本原样包进围栏。
 * 围栏须独占整行，故光标不在行首时先断行；闭合围栏后补一个换行，与下文分隔。
 *
 * @param {object} options
 * @param {string} options.selection   选中的文本（无选区传空串）
 * @param {boolean} options.atLineStart 插入点是否位于行首
 * @returns {{ insert: string, cursorOffset: number }} cursorOffset 为相对插入起点的偏移
 */
export const buildCodeBlockInsertion = ({ selection = '', atLineStart = true } = {}) => {
    const leading = atLineStart ? '' : '\n'
    return {
        insert: `${leading}${FENCE}\n${selection}\n${FENCE}\n`,
        cursorOffset: leading.length + FENCE.length
    }
}

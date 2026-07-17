import { openSearchPanel } from '@codemirror/search'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { findTaskMarker } from '../core/markdown/taskMarker.js'
import { findTextMatch } from '../core/search/match.js'
import { createEditorExtensions } from './extensions/setup.js'
import { editorTheme } from './extensions/theme.js'
import { setSearchHighlight } from './extensions/searchHighlight.js'
import { compressImagesToMarkdown } from './extensions/imagePaste.js'

/**
 * 编辑器唯一门面：Vue 组件只提供挂载点，所有编辑命令/查询都经由这里，
 * 内部走 CodeMirror 原生 API（dispatch / lineBlockAt / scrollIntoView / requestMeasure）。
 *
 * 多文档：为每个 documentId 保存独立的 EditorState（含各自 undo 历史），
 * 切换文档用 view.setState() 而非整段替换，避免跨文档撤销栈污染。
 *
 * @param {object} options
 * @param {HTMLElement} options.parent          挂载点
 * @param {string} options.docId                初始文档 id
 * @param {string} options.doc                  初始文本
 * @param {(text: string) => void} options.onDocChanged
 * @param {(kind: 'edit'|'select'|'pointer') => void} options.onUserIntent
 * @param {() => void} options.onScroll
 * @param {object} options.completion            Markdown 补全数据 getter
 */
export const createEditorController = ({
    parent,
    docId = null,
    doc = '',
    onDocChanged,
    onUserIntent,
    onScroll,
    onImageNotify,
    completion
}) => {
    const { extensions, themeCompartment } = createEditorExtensions({
        onDocChanged,
        onUserIntent,
        onImageNotify,
        completion
    })

    const buildState = (text) => EditorState.create({ doc: text, extensions })

    const view = new EditorView({ state: buildState(doc), parent })

    // documentId -> EditorState，保存每个文档的内容、选区与独立 undo 历史。
    const states = new Map()
    let currentDocId = docId
    states.set(currentDocId, view.state)

    const handleScroll = () => onScroll?.()
    view.scrollDOM.addEventListener('scroll', handleScroll, { passive: true })

    const getLine = (lineNumber) => {
        const document = view.state.doc
        return document.line(Math.min(Math.max(1, Number(lineNumber) || 1), document.lines))
    }

    // 把「行号 + 可选列偏移/查询词」解析为文档内的绝对区间。
    const resolveRange = (lineNumber, { columns, query } = {}) => {
        const line = getLine(lineNumber)
        if (!line) return null

        if (columns && Number.isInteger(columns.from) && columns.from >= 0 && columns.from <= line.length) {
            return {
                from: line.from + columns.from,
                to: Math.min(line.to, line.from + (Number.isInteger(columns.to) ? columns.to : columns.from))
            }
        }

        const match = findTextMatch(line.text, query)
        return match ? { from: line.from + match.from, to: line.from + match.to } : { from: line.from, to: line.to }
    }

    const measureScrollTop = (position, viewportRatio, attempts = 2) =>
        new Promise((resolve) => {
            view.requestMeasure({
                read(measuredView) {
                    const coords = measuredView.coordsAtPos(position)
                    if (!coords) return Number.NaN

                    const scrollRect = measuredView.scrollDOM.getBoundingClientRect()
                    return (
                        measuredView.scrollDOM.scrollTop +
                        coords.top -
                        scrollRect.top -
                        measuredView.scrollDOM.clientHeight * viewportRatio
                    )
                },
                write(measuredTop) {
                    if (Number.isFinite(measuredTop) || attempts <= 1) {
                        resolve(Number.isFinite(measuredTop) ? measuredTop : view.scrollDOM.scrollTop)
                    } else {
                        measureScrollTop(position, viewportRatio, attempts - 1).then(resolve)
                    }
                }
            })
        })

    return {
        // 切换活动文档：先暂存当前文档状态，再恢复/新建目标文档状态并 setState。
        setActiveDocument(id, text = '') {
            if (id === currentDocId) return
            if (currentDocId != null) states.set(currentDocId, view.state)
            currentDocId = id
            view.setState(states.get(id) ?? buildState(text))
        },

        // 文档被删除时丢弃其保存的状态，避免注册表无限增长。
        forgetDocument(id) {
            if (id !== currentDocId) states.delete(id)
        },

        // 对当前活动文档整段替换（如清空内容），作为可撤销的文档内编辑。
        setDoc(text) {
            if (text === view.state.doc.toString()) return
            const anchor = Math.min(view.state.selection.main.anchor, text.length)
            view.dispatch({
                changes: { from: 0, to: view.state.doc.length, insert: text },
                selection: { anchor }
            })
        },

        getDoc: () => view.state.doc.toString(),
        docLength: () => view.state.doc.length,

        // 在当前光标处插入图片（压缩为内联 base64）。供全局拖拽导入把图片插入活动文档，
        // 与粘贴共用同一压缩逻辑；超限/失败提示走 onImageNotify。
        async insertImages(files) {
            const insert = await compressImagesToMarkdown(files, { onNotify: onImageNotify })
            if (!insert) return
            const pos = Math.min(view.state.selection.main.to, view.state.doc.length)
            view.dispatch({
                changes: { from: pos, to: pos, insert },
                selection: { anchor: pos + insert.length }
            })
            view.focus()
        },

        // 指定行的像素顶部偏移（供锚点表 / 滚动定位使用）
        lineTop(lineNumber) {
            const line = getLine(lineNumber)
            return line ? view.lineBlockAt(line.from).top : Number.NaN
        },

        // 定位到某行（可选选中命中区间、滚动、聚焦）
        revealLine(lineNumber, { match, query, select = true, scroll = false, focus = true } = {}) {
            const range = resolveRange(lineNumber, { columns: match, query })
            if (!range) return false

            const transaction = { selection: select ? { anchor: range.from } : undefined }
            if (scroll) {
                transaction.effects = EditorView.scrollIntoView(range.from, { y: 'center' })
            }
            view.dispatch(transaction)

            if (focus) view.contentDOM.focus({ preventScroll: !scroll })
            return true
        },

        // CodeMirror 先用原生滚动把远距离目标纳入真实视口，再在同一测量周期返回精确滚动位置。
        async revealLineMeasured(lineNumber, { match, query, select = true, focus = true, viewportRatio = 0.3 } = {}) {
            const range = resolveRange(lineNumber, { columns: match, query })
            if (!range) return Number.NaN

            view.dispatch({
                selection: select ? { anchor: range.from } : undefined,
                effects: EditorView.scrollIntoView(range.from, { y: 'center' })
            })
            if (focus) view.contentDOM.focus({ preventScroll: true })

            return measureScrollTop(range.from, viewportRatio)
        },

        // 勾选 / 取消指定行的任务列表项：改写该行的 [ ]/[x] 状态字符，是可撤销的常规编辑。
        // 该行没有任务标记（内容已变、行号漂移）时不改写并返回 false，由调用方回退 UI。
        setTaskChecked(lineNumber, checked) {
            const line = Number.isFinite(Number(lineNumber)) ? getLine(lineNumber) : null
            const marker = line ? findTaskMarker(line.text) : null
            if (!marker) return false

            if (marker.checked !== Boolean(checked)) {
                view.dispatch({
                    changes: {
                        from: line.from + marker.from,
                        to: line.from + marker.to,
                        insert: checked ? 'x' : ' '
                    }
                })
            }
            return true
        },

        // 打开查找替换面板（已打开则聚焦查询框并全选，便于直接输入新查询词）。
        openSearch() {
            openSearchPanel(view)
        },

        // 搜索高亮：match = { lineNumber, from, to } 或 null（清除）
        setSearchHighlight(match) {
            const range =
                match && Number.isFinite(match.lineNumber)
                    ? resolveRange(match.lineNumber, {
                          columns: { from: match.from, to: match.to },
                          query: match.query
                      })
                    : null
            setSearchHighlight(view, range)
        },

        get scrollDOM() {
            return view.scrollDOM
        },

        refresh: () => view.requestMeasure(),

        focus: ({ preventScroll = false } = {}) => view.contentDOM.focus({ preventScroll }),

        // 预留暗色主题热切换：controller.setTheme(darkTheme)
        setTheme: (themeExtension = editorTheme) => {
            view.dispatch({ effects: themeCompartment.reconfigure(themeExtension) })
        },

        destroy() {
            view.scrollDOM.removeEventListener('scroll', handleScroll)
            view.destroy()
            states.clear()
        }
    }
}

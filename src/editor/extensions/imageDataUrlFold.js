import { RangeSetBuilder, StateField } from '@codemirror/state'
import { Decoration, EditorView, WidgetType } from '@codemirror/view'

// 把内联图片的 base64 数据在编辑器里折叠成简短占位（⋯ 图片数据 12KB ⋯），改善阅读体验。
// 仅显示层折叠：文档实际内容不变，预览 / 导出 / 复制拿到的仍是完整 base64。
// base64 不可读且极长，故【始终折叠、不随光标展开】——展开成超长单行会触发编辑器渲染空白。
//
// 用 StateField（而非 ViewPlugin）提供 decoration：StateField 随事务在状态层原子更新，
// 插入的当帧就参与布局；ViewPlugin 的 decoration 在视图更新阶段计算、比文本插入慢一拍，
// 会导致刚粘贴的超长 base64 行以未折叠高度渲染、撑出大片空白，需再一次交互/滚动才收敛。
const DATA_URL_RE = /data:image\/[a-zA-Z0-9.+-]+;base64,([A-Za-z0-9+/=]+)/g
const FOLD_THRESHOLD = 48

const formatSize = (base64Length) => {
    const bytes = Math.floor((base64Length * 3) / 4)
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

class DataUrlWidget extends WidgetType {
    constructor(label) {
        super()
        this.label = label
    }

    eq(other) {
        return other.label === this.label
    }

    toDOM() {
        const span = document.createElement('span')
        span.className = 'cm-data-url-fold'
        span.textContent = `⋯ 图片数据 ${this.label} ⋯`
        return span
    }

    ignoreEvent() {
        return false
    }
}

const buildDecorations = (state) => {
    const builder = new RangeSetBuilder()

    // 扫描整个文档而非仅可视区：base64 超长会跨多个视口，按视口切片会匹配不到完整 data url，
    // 导致滚动到中段时折叠失效、露出原始字符。整文档匹配保证折叠始终完整。
    const text = state.doc.toString()
    DATA_URL_RE.lastIndex = 0
    let match
    while ((match = DATA_URL_RE.exec(text))) {
        const base64 = match[1]
        if (base64.length < FOLD_THRESHOLD) continue

        // 只折叠 base64 数据部分，保留 `data:image/png;base64,` 前缀可见。
        const dataStart = match.index + (match[0].length - base64.length)
        const dataEnd = match.index + match[0].length
        builder.add(dataStart, dataEnd, Decoration.replace({ widget: new DataUrlWidget(formatSize(base64.length)) }))
    }

    return builder.finish()
}

export const imageDataUrlFold = StateField.define({
    create: (state) => buildDecorations(state),
    // decoration 覆盖整文档、与光标无关，只需在文档变化时重建。
    update: (value, tr) => (tr.docChanged ? buildDecorations(tr.state) : value),
    provide: (field) => [
        EditorView.decorations.from(field),
        // 折叠段作为原子区间：光标跳过、退格 / 选择按整体处理。
        EditorView.atomicRanges.of((view) => view.state.field(field, false) || Decoration.none)
    ]
})

export const imageDataUrlFoldTheme = EditorView.baseTheme({
    '.cm-data-url-fold': {
        padding: '0 6px',
        borderRadius: '4px',
        background: 'var(--color-surface-active)',
        color: 'var(--color-subtle)',
        fontStyle: 'normal',
        fontSize: '0.85em',
        whiteSpace: 'nowrap',
        cursor: 'default'
    }
})

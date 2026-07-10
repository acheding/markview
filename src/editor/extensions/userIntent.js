import { EditorView } from '@codemirror/view'

// 把「文档变化」与「用户主动意图（编辑/选择/点按）」以回调形式抛给控制器：
//   onDocChanged(text)  —— 文档内容变化
//   onUserIntent(kind)  —— kind: 'edit' | 'select' | 'pointer'，用于消除搜索高亮
export const userIntentExtension = ({ onDocChanged, onUserIntent }) => [
    EditorView.updateListener.of((update) => {
        if (update.docChanged) {
            onDocChanged?.(update.state.doc.toString())
        }

        const hasUserSelection =
            update.selectionSet && update.transactions.some((transaction) => transaction.isUserEvent('select'))
        const hasUserEdit =
            update.docChanged && update.transactions.some((transaction) => transaction.isUserEvent('input'))

        if (hasUserEdit) onUserIntent?.('edit')
        else if (hasUserSelection) onUserIntent?.('select')
    }),
    EditorView.domEventHandlers({
        pointerdown: () => {
            onUserIntent?.('pointer')
            return false
        }
    })
]

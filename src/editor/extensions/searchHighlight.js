import { StateEffect, StateField } from '@codemirror/state'
import { Decoration, EditorView } from '@codemirror/view'

const setSearchHighlightEffect = StateEffect.define()

// 搜索命中是独立 Decoration，不占用光标选区，也不会因编辑器失焦而改变颜色。
export const searchHighlightField = StateField.define({
    create: () => Decoration.none,
    update(highlights, transaction) {
        let nextHighlights = highlights.map(transaction.changes)

        for (const effect of transaction.effects) {
            if (effect.is(setSearchHighlightEffect)) {
                nextHighlights = effect.value
                    ? Decoration.set([
                          Decoration.mark({ class: 'cm-search-highlight' }).range(effect.value.from, effect.value.to)
                      ])
                    : Decoration.none
            }
        }

        return nextHighlights
    },
    provide: (field) => EditorView.decorations.from(field)
})

export const setSearchHighlight = (view, range) => {
    view.dispatch({
        effects: setSearchHighlightEffect.of(range)
    })
}

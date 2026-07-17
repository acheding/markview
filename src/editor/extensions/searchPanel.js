import {
    SearchQuery,
    closeSearchPanel,
    findNext,
    findPrevious,
    getSearchQuery,
    replaceAll,
    replaceNext,
    setSearchQuery
} from '@codemirror/search'
import { runScopeHandlers } from '@codemirror/view'
import { attachTooltip, detachTooltip } from '../../directives/tooltip.js'

// 自定义查找替换面板：替代 @codemirror/search 的默认面板 DOM，查找/替换命令仍全部复用官方实现。
// 自定义的动机：默认面板无法做「当前 x / 共 y」计数、内嵌开关、出入场动画等深度定制。
// 与官方面板保持同一契约：查询框带 [main-field] 供 openSearchPanel 聚焦全选；
// keydown 先走 runScopeHandlers 的 search-panel 作用域（Esc 关闭、Mod-F 重新聚焦、F3 跳转）。

// 命中计数上限：超过即显示 999+，避免极端查询全文迭代过久。
const MAX_COUNT = 999

const prefersReducedMotion = () =>
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const crel = (tag, attrs = {}, children = []) => {
    const el = document.createElement(tag)
    for (const [key, value] of Object.entries(attrs)) {
        if (key.startsWith('on')) el[key] = value
        else el.setAttribute(key, value)
    }
    for (const child of children) el.append(child)
    return el
}

// 线条图标（stroke 跟随 currentColor），内容为常量路径，无用户输入。
const iconSvg = (path) =>
    `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${path}"/></svg>`

const ICONS = {
    prev: 'M3.5 9.75 8 5.25l4.5 4.5',
    next: 'M3.5 6.25 8 10.75l4.5-4.5',
    close: 'M4.25 4.25l7.5 7.5M11.75 4.25l-7.5 7.5'
}

class MarkviewSearchPanel {
    constructor(view) {
        this.view = view
        this.query = getSearchQuery(view.state)
        this.top = true
        this.commit = this.commit.bind(this)

        this.searchField = crel('input', {
            class: 'mv-search__input',
            name: 'search',
            form: '',
            'main-field': 'true',
            placeholder: '查找',
            'aria-label': '查找',
            oninput: this.commit,
            onchange: this.commit
        })
        this.searchField.value = this.query.search

        this.replaceField = crel('input', {
            class: 'mv-search__input',
            name: 'replace',
            form: '',
            placeholder: '替换为',
            'aria-label': '替换为',
            oninput: this.commit,
            onchange: this.commit
        })
        this.replaceField.value = this.query.replace

        this.countEl = crel('span', { class: 'mv-search__count', 'aria-hidden': 'true' })

        // 悬浮提示复用全局 v-tooltip 的气泡（directives/tooltip.js 的命令式 API），
        // 面板销毁时统一 detach，避免气泡驻留。
        this.tooltipTargets = []
        const withTooltip = (el, tip) => {
            attachTooltip(el, tip)
            this.tooltipTargets.push(el)
            return el
        }

        const toggle = (name, label, tip, pressed) => {
            const button = crel('button', {
                class: 'mv-search__toggle',
                type: 'button',
                name,
                'aria-label': tip,
                'aria-pressed': String(Boolean(pressed))
            })
            button.textContent = label
            button.onclick = () => {
                button.setAttribute('aria-pressed', String(button.getAttribute('aria-pressed') !== 'true'))
                this.commit()
            }
            return withTooltip(button, tip)
        }
        this.caseToggle = toggle('case', 'Aa', '区分大小写', this.query.caseSensitive)
        this.wordToggle = toggle('word', 'ab', '全词匹配', this.query.wholeWord)
        this.reToggle = toggle('re', '.*', '正则表达式', this.query.regexp)

        const button = (name, tip, { icon, label, extraClass = '' } = {}, onclick) => {
            const el = crel('button', {
                class: `mv-search__btn${icon ? ' mv-search__btn--icon' : ''}${extraClass ? ` ${extraClass}` : ''}`,
                type: 'button',
                name,
                'aria-label': typeof tip === 'string' ? tip : tip.text
            })
            if (icon) el.innerHTML = iconSvg(icon)
            else el.textContent = label
            el.onclick = onclick
            return withTooltip(el, tip)
        }
        this.prevButton = button('prev', { text: '上一个', keys: 'Shift+F3' }, { icon: ICONS.prev }, () =>
            findPrevious(view)
        )
        this.nextButton = button('next', { text: '下一个', keys: 'F3' }, { icon: ICONS.next }, () => findNext(view))
        this.replaceButton = button('replace', { text: '替换当前命中', keys: 'Enter' }, { label: '替换' }, () =>
            replaceNext(view)
        )
        this.replaceAllButton = button('replaceAll', '替换全部命中', { label: '全部替换' }, () => replaceAll(view))
        const closeButton = button(
            'close',
            { text: '关闭', keys: 'Esc' },
            { icon: ICONS.close, extraClass: 'mv-search__close' },
            () => closeSearchPanel(view)
        )

        // grid 两列（输入框列 + 动作列）× 两行：查询/替换输入框天然等宽对齐，
        // 关闭按钮经 margin-left:auto 固定在面板右上角。
        this.dom = crel('div', { class: 'mv-search', onkeydown: (event) => this.keydown(event) }, [
            crel('div', { class: 'mv-search__field' }, [
                this.searchField,
                this.countEl,
                this.caseToggle,
                this.wordToggle,
                this.reToggle
            ]),
            crel('div', { class: 'mv-search__actions' }, [this.prevButton, this.nextButton, closeButton]),
            crel('div', { class: 'mv-search__field' }, [this.replaceField]),
            crel('div', { class: 'mv-search__actions' }, [this.replaceButton, this.replaceAllButton])
        ])

        this.updateCount()
    }

    pressed(button) {
        return button.getAttribute('aria-pressed') === 'true'
    }

    commit() {
        const query = new SearchQuery({
            search: this.searchField.value,
            caseSensitive: this.pressed(this.caseToggle),
            regexp: this.pressed(this.reToggle),
            wholeWord: this.pressed(this.wordToggle),
            replace: this.replaceField.value
        })
        if (!query.eq(this.query)) {
            this.query = query
            this.view.dispatch({ effects: setSearchQuery.of(query) })
        }
    }

    keydown(event) {
        // 与官方面板同契约：先交给 search-panel 作用域键位（Esc 关闭、F3/Mod-G 跳转、Mod-F 重新聚焦）。
        if (runScopeHandlers(this.view, event, 'search-panel')) {
            event.preventDefault()
        } else if (event.key === 'Enter' && event.target === this.searchField) {
            event.preventDefault()
            ;(event.shiftKey ? findPrevious : findNext)(this.view)
        } else if (event.key === 'Enter' && event.target === this.replaceField) {
            event.preventDefault()
            replaceNext(this.view)
        }
    }

    update(update) {
        let queryChanged = false
        for (const tr of update.transactions) {
            for (const effect of tr.effects) {
                // 注意不能只在 !eq 时置位：commit() 先存 this.query 再 dispatch，
                // 自己提交的查询到这里必然「相等」，但计数仍需随本次查询变化重算。
                if (effect.is(setSearchQuery)) {
                    queryChanged = true
                    if (!effect.value.eq(this.query)) this.setQuery(effect.value)
                }
            }
        }
        // 文档编辑、选区移动（F3 跳转）、查询变化都会改变「当前/总数」。
        if (queryChanged || update.docChanged || update.selectionSet) this.updateCount()
    }

    setQuery(query) {
        this.query = query
        this.searchField.value = query.search
        this.replaceField.value = query.replace
        this.caseToggle.setAttribute('aria-pressed', String(query.caseSensitive))
        this.wordToggle.setAttribute('aria-pressed', String(query.wholeWord))
        this.reToggle.setAttribute('aria-pressed', String(query.regexp))
    }

    // 统计命中总数与当前命中序号（当前 = 与主选区完全重合的那一处，即 findNext 选中的命中）。
    updateCount() {
        const { query } = this
        let text = ''
        let isEmpty = false
        let total = 0

        if (query.search && !query.valid) {
            text = '表达式无效'
            isEmpty = true
        } else if (query.search) {
            const state = this.view.state
            const selection = state.selection.main
            let current = 0
            let overflow = false

            const cursor = query.getCursor(state)
            for (let step = cursor.next(); !step.done; step = cursor.next()) {
                total += 1
                if (step.value.from === selection.from && step.value.to === selection.to) current = total
                if (total > MAX_COUNT) {
                    overflow = true
                    break
                }
            }

            if (overflow) text = `${current} / ${MAX_COUNT}+`
            else {
                text = `${current} / ${total}`
                isEmpty = total === 0
            }
        }

        this.countEl.textContent = text
        this.countEl.classList.toggle('is-empty', isEmpty)

        const inactive = total === 0
        for (const el of [this.prevButton, this.nextButton, this.replaceButton, this.replaceAllButton]) {
            el.disabled = inactive
        }
    }

    mount() {
        this.searchField.select()
        if (!prefersReducedMotion()) {
            this.dom.animate(
                [
                    { opacity: 0, transform: 'translateY(-6px)' },
                    { opacity: 1, transform: 'translateY(0)' }
                ],
                { duration: 170, easing: 'cubic-bezier(0.25, 0.8, 0.35, 1)' }
            )
        }
    }

    // 面板移除没有原生的离场机会：克隆一份「幽灵」覆盖在原位淡出，克隆完成后立刻移除。
    destroy() {
        // 先解绑悬浮提示：若关闭瞬间气泡正指向面板内按钮，就地收起。
        this.tooltipTargets.forEach(detachTooltip)

        if (prefersReducedMotion() || typeof this.dom.animate !== 'function') return

        const source = this.dom.closest('.cm-panels') ?? this.dom
        const ghost = source.cloneNode(true)
        // cloneNode 不复制输入框的当前值，手动带过去，避免淡出瞬间文字消失。
        const sourceInputs = source.querySelectorAll('input')
        ghost.querySelectorAll('input').forEach((input, index) => {
            input.value = sourceInputs[index]?.value ?? ''
        })
        // 悬浮定位样式随 .cm-panels 类名一起被克隆（主题里定义），这里只需保证不可交互。
        Object.assign(ghost.style, { zIndex: '10', pointerEvents: 'none' })

        this.view.dom.appendChild(ghost)
        const animation = ghost.animate(
            [
                { opacity: 1, transform: 'translateY(0)' },
                { opacity: 0, transform: 'translateY(-8px)' }
            ],
            { duration: 140, easing: 'ease-in' }
        )
        const dispose = () => ghost.remove()
        animation.onfinish = dispose
        animation.oncancel = dispose
        // 极端情况下动画事件不触发（标签页隐藏等）也要清掉幽灵节点。
        setTimeout(dispose, 500)
    }
}

export const markviewSearchPanel = (view) => new MarkviewSearchPanel(view)

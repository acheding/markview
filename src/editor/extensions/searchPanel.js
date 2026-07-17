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
// keydown 先走 runScopeHandlers 的 search-panel 作用域（Esc 关闭、F3 跳转；
// Mod-F 已从键位表剔除，冒泡到全局快捷键后同样回焦查询框）。

// 命中计数上限：超过即显示 999+，避免极端查询全文迭代过久。
const MAX_COUNT = 999

// 快捷键展示文案的修饰键：与 composables/shortcuts.js 同规则，macOS 显示 Cmd。
const MOD_KEY = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform) ? 'Cmd' : 'Ctrl'

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

// 图标（均跟随 currentColor，内容为常量路径，无用户输入）：
//   字符串 = 自绘线条图标（stroke）；数组 = 多段实心 path（fill）。
const iconSvg = (icon) =>
    Array.isArray(icon)
        ? `<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">${icon
              .map((d) => `<path fill-rule="evenodd" clip-rule="evenodd" d="${d}"/>`)
              .join('')}</svg>`
        : `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${icon}"/></svg>`

const ICONS = {
    prev: 'M3.5 9.75 8 5.25l4.5 4.5',
    next: 'M3.5 6.25 8 10.75l4.5-4.5',
    close: 'M4.25 4.25l7.5 7.5M11.75 4.25l-7.5 7.5',
    // 替换 / 全部替换：VS Code codicon 的 replace / replace-all 原版字形
    // （microsoft/vscode-codicons，CC BY 4.0），字母 + 折弯箭头的组合语义。
    replace: [
        'M10 2.813C10.295 2.619 10.634 2.5 11 2.5C12.103 2.5 13 3.509 13 4.75C13 5.991 12.103 7 11 7C10.62 7 10.269 6.873 9.966 6.666C9.897 6.86 9.717 7 9.5 7C9.224 7 9 6.776 9 6.5V1.5C9 1.224 9.224 1 9.5 1C9.776 1 10 1.224 10 1.5V2.813ZM10 4.75C10 5.439 10.448 6 11 6C11.552 6 12 5.439 12 4.75C12 4.061 11.552 3.5 11 3.5C10.448 3.5 10 4.061 10 4.75Z',
        'M2 9H7C7.552 9 8 9.448 8 10V15C8 15.552 7.552 16 7 16H2C1.448 16 1 15.552 1 15V10C1 9.448 1.448 9 2 9ZM5.039 13.645C4.81 13.849 4.199 13.968 3.83 13.506C3.617 13.24 3.5 12.88 3.5 12.492C3.5 12.104 3.618 11.744 3.83 11.478C4.201 11.014 4.811 11.133 5.04 11.339C5.244 11.525 5.56 11.507 5.746 11.303C5.931 11.098 5.915 10.782 5.709 10.597C4.922 9.887 3.733 10.001 3.049 10.853C2.695 11.297 2.5 11.878 2.5 12.492C2.5 13.106 2.695 13.688 3.049 14.131C3.43 14.605 3.945 14.867 4.5 14.867C4.941 14.867 5.359 14.701 5.708 14.387C5.913 14.202 5.93 13.886 5.745 13.681C5.559 13.476 5.243 13.458 5.039 13.645Z',
        'M3.99998 4.5C3.99998 3.673 4.67298 3 5.49998 3H7.50198C7.77798 3 8.00198 3.224 8.00198 3.5C8.00198 3.776 7.77798 4 7.50198 4H5.50198C5.22598 4 5.00198 4.225 5.00198 4.5V6.293L6.14798 5.147C6.34298 4.952 6.65998 4.952 6.85498 5.147C7.04998 5.342 7.04998 5.659 6.85498 5.854L4.85498 7.854C4.75698 7.951 4.62898 8 4.50098 8C4.37298 8 4.24498 7.952 4.14698 7.854L2.14698 5.854C1.95198 5.659 1.95198 5.342 2.14698 5.147C2.34198 4.952 2.65898 4.952 2.85398 5.147L3.99998 6.293V4.5Z'
    ],
    replaceAll: [
        'M14 13V10C14 8.35 12.65 7 11 7H5.12L4.12 8H11C12.1 8 13 8.9 13 10V14C13.55 14 14 13.55 14 13Z',
        'M10.999 5.5V2.75C10.999 1.765 10.12 1.25 9.25 1.25C8.362 1.25 7.989 1.553 7.896 1.646C7.701 1.841 7.687 2.17 7.882 2.365C8.076 2.561 8.379 2.573 8.575 2.378C8.57462 2.37825 8.57506 2.37797 8.575 2.378C8.58734 2.36997 8.77165 2.25 9.249 2.25C9.279 2.25 9.999 2.256 9.999 2.75V3.056C9.795 3.023 9.551 3 9.249 3C7.936 3 7.249 3.754 7.249 4.5C7.249 5.246 7.936 6 9.249 6C9.621 6 9.91 5.937 10.144 5.851C10.235 5.943 10.36 6 10.499 6C10.775 6 10.999 5.776 10.999 5.5ZM9.25 4C9.622 4 9.856 4.038 10 4.074V4.811C9.907 4.885 9.697 5 9.25 5C8.601 5 8.25 4.742 8.25 4.5C8.25 4.258 8.601 4 9.25 4Z',
        'M5.001 13.074C4.857 13.038 4.623 13 4.251 13C3.602 13 3.251 13.258 3.251 13.5C3.251 13.742 3.602 14 4.251 14C4.698 14 4.908 13.885 5.001 13.811V13.074Z',
        'M12 15V10C12 9.448 11.552 9 11 9H2C1.448 9 1 9.448 1 10V15C1 15.552 1.448 16 2 16H11C11.552 16 12 15.552 12 15ZM4.251 10.25C5.121 10.25 6 10.765 6 11.75V14.5C6 14.776 5.776 15 5.5 15C5.361 15 5.236 14.943 5.145 14.851C4.911 14.937 4.622 15 4.25 15C2.937 15 2.25 14.246 2.25 13.5C2.25 12.754 2.937 12 4.25 12C4.552 12 4.796 12.023 5 12.056V11.75C5 11.256 4.28 11.25 4.25 11.25C3.78749 11.25 3.6007 11.3631 3.57831 11.3767C3.57688 11.3775 3.57612 11.378 3.576 11.378C3.38 11.573 3.077 11.561 2.883 11.365C2.688 11.17 2.702 10.841 2.897 10.646C2.99 10.553 3.363 10.25 4.251 10.25ZM8.33 11.611C8.117 11.877 8 12.237 8 12.625C8 13.013 8.117 13.373 8.33 13.639C8.699 14.101 9.31 13.982 9.539 13.778C9.743 13.591 10.059 13.609 10.245 13.814C10.43 14.019 10.414 14.335 10.208 14.52C9.86 14.834 9.442 15 9 15C8.445 15 7.929 14.739 7.549 14.264C7.195 13.82 7 13.239 7 12.625C7 12.011 7.195 11.429 7.549 10.986C8.233 10.134 9.422 10.02 10.209 10.73C10.414 10.915 10.431 11.231 10.246 11.436C10.06 11.64 9.744 11.658 9.54 11.472C9.311 11.266 8.701 11.147 8.33 11.611Z',
        'M14 6C15.103 6 16 4.991 16 3.75C16 2.509 15.103 1.5 14 1.5C13.634 1.5 13.295 1.619 13 1.813V0.5C13 0.224 12.776 0 12.5 0C12.224 0 12 0.224 12 0.5V5.5C12 5.776 12.224 6 12.5 6C12.717 6 12.897 5.86 12.966 5.666C13.269 5.873 13.62 6 14 6ZM14 2.5C14.552 2.5 15 3.061 15 3.75C15 4.439 14.552 5 14 5C13.448 5 13 4.439 13 3.75C13 3.061 13.448 2.5 14 2.5Z',
        'M1.99998 4.5C1.99998 3.673 2.67298 3 3.49998 3H5.50198C5.77798 3 6.00198 3.224 6.00198 3.5C6.00198 3.776 5.77798 4 5.50198 4H3.50198C3.22598 4 3.00198 4.225 3.00198 4.5V6.293L4.14798 5.147C4.34298 4.952 4.65998 4.952 4.85498 5.147C5.04998 5.342 5.04998 5.659 4.85498 5.854L2.85498 7.854C2.75698 7.951 2.62898 8 2.50098 8C2.37298 8 2.24498 7.952 2.14698 7.854L0.146982 5.854C-0.0480176 5.659 -0.0480176 5.342 0.146982 5.147C0.341982 4.952 0.658982 4.952 0.853982 5.147L1.99998 6.293V4.5Z'
    ]
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
        this.wordToggle = toggle('word', 'ab', '全字匹配', this.query.wholeWord)
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
        this.replaceButton = button('replace', { text: '替换', keys: 'Enter' }, { icon: ICONS.replace }, () =>
            replaceNext(view)
        )
        this.replaceAllButton = button(
            'replaceAll',
            { text: '全部替换', keys: `${MOD_KEY}+Alt+Enter` },
            { icon: ICONS.replaceAll },
            () => replaceAll(view)
        )
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
        } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && event.altKey) {
            // 与 VS Code 一致：Mod+Alt+Enter 全部替换，面板内任意位置可触发。
            event.preventDefault()
            replaceAll(this.view)
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

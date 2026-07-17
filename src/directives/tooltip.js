// v-tooltip 指令：轻量自定义气泡，替代原生 title（原生延迟长、样式不可控、不随主题）。
// 值为字符串，或 { text, keys }——keys 以等宽 kbd 呈现快捷键。
// 浮层为全局单例、挂在 body 下（样式见 styles/tooltip.css），同一时刻只会有一个气泡。

const SHOW_DELAY = 300
const GAP = 8

let bubble = null
let showTimer = 0
let activeEl = null

const values = new WeakMap()

const ensureBubble = () => {
    if (bubble) return bubble
    bubble = document.createElement('div')
    bubble.className = 'app-tooltip'
    bubble.setAttribute('role', 'tooltip')
    document.body.appendChild(bubble)
    return bubble
}

const render = (value) => {
    const { text, keys } = typeof value === 'string' ? { text: value } : value || {}
    const el = ensureBubble()
    el.textContent = ''
    const label = document.createElement('span')
    label.className = 'app-tooltip__text'
    label.textContent = text || ''
    el.appendChild(label)
    if (keys) {
        const kbd = document.createElement('kbd')
        kbd.className = 'app-tooltip__keys'
        kbd.textContent = keys
        el.appendChild(kbd)
    }
}

const position = (target) => {
    const rect = target.getBoundingClientRect()
    const { offsetWidth: width, offsetHeight: height } = bubble
    // 目标下方居中；水平钳制在视口内，底部放不下则翻到上方。
    const left = Math.min(Math.max(rect.left + rect.width / 2 - width / 2, GAP), window.innerWidth - width - GAP)
    let top = rect.bottom + GAP
    if (top + height > window.innerHeight - GAP) top = rect.top - height - GAP
    bubble.style.left = `${Math.round(left)}px`
    bubble.style.top = `${Math.round(top)}px`
}

const hide = () => {
    window.clearTimeout(showTimer)
    showTimer = 0
    activeEl = null
    bubble?.classList.remove('is-visible')
    window.removeEventListener('scroll', hide, true)
    window.removeEventListener('resize', hide)
}

const show = (el) => {
    const value = values.get(el)
    if (!value) return
    activeEl = el
    render(value)
    position(el)
    bubble.classList.add('is-visible')
    // 定位基于视口坐标，滚动 / 缩放即失效，直接收起。
    window.addEventListener('scroll', hide, true)
    window.addEventListener('resize', hide)
}

const scheduleShow = (el, delay) => {
    window.clearTimeout(showTimer)
    showTimer = window.setTimeout(() => show(el), delay)
}

// 触屏没有悬停语义：点按会补发模拟的 enter 且不再有 leave，气泡会一直驻留，故忽略 touch。
const onPointerEnter = (event) => {
    if (event.pointerType !== 'touch') scheduleShow(event.currentTarget, SHOW_DELAY)
}

// 仅键盘聚焦立即显示；鼠标点击带来的 focus 不弹，避免点完气泡驻留。
const onFocus = (event) => {
    if (event.currentTarget.matches(':focus-visible')) scheduleShow(event.currentTarget, 0)
}

export const tooltip = {
    mounted(el, binding) {
        values.set(el, binding.value)
        el.addEventListener('pointerenter', onPointerEnter)
        el.addEventListener('pointerleave', hide)
        el.addEventListener('focus', onFocus)
        el.addEventListener('blur', hide)
        // 点击多半触发弹窗 / 状态切换，气泡先行退场。
        el.addEventListener('pointerdown', hide)
    },
    updated(el, binding) {
        values.set(el, binding.value)
        // 内容动态变化（如主题按钮文案）且正在展示时，就地刷新。
        if (activeEl === el && bubble?.classList.contains('is-visible')) {
            render(binding.value)
            position(el)
        }
    },
    unmounted(el) {
        values.delete(el)
        if (activeEl === el) hide()
        el.removeEventListener('pointerenter', onPointerEnter)
        el.removeEventListener('pointerleave', hide)
        el.removeEventListener('focus', onFocus)
        el.removeEventListener('blur', hide)
        el.removeEventListener('pointerdown', hide)
    }
}

const parseTime = (value) => {
    const text = String(value).trim()
    if (text.endsWith('ms')) return Number.parseFloat(text) || 0
    if (text.endsWith('s')) return (Number.parseFloat(text) || 0) * 1000
    return 0
}

export const waitForTransition = (element, properties = []) => {
    if (!element) return Promise.resolve()

    const styles = getComputedStyle(element)
    const durations = styles.transitionDuration.split(',').map(parseTime)
    const delays = styles.transitionDelay.split(',').map(parseTime)
    const itemCount = Math.max(durations.length, delays.length)
    const maxDuration = Array.from({ length: itemCount }, (_, index) => {
        return durations[index % durations.length] + delays[index % delays.length]
    }).reduce((maximum, duration) => Math.max(maximum, duration), 0)

    if (maxDuration <= 0) return Promise.resolve()

    return new Promise((resolve) => {
        let timeoutId = null

        const finish = () => {
            clearTimeout(timeoutId)
            element.removeEventListener('transitionend', handleTransitionEnd)
            resolve()
        }

        const handleTransitionEnd = (event) => {
            if (event.target !== element) return
            if (properties.length && !properties.includes(event.propertyName)) return
            finish()
        }

        element.addEventListener('transitionend', handleTransitionEnd)
        // transitioncancel 在部分浏览器行为不一致，因此保留一个由计算样式推导的兜底超时。
        timeoutId = setTimeout(finish, maxDuration + 50)
    })
}

export const waitForAnimationFrame = () =>
    new Promise((resolve) => {
        requestAnimationFrame(resolve)
    })

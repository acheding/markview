// 目录折叠的视图计算：扁平标题列表（含 level）按层级折叠后得到可见项。
// 父项 = 向前最近的 level 更小的标题；折叠某项即隐藏其整棵子树。

/**
 * @param {Array<{ id: string, title: string, level: number }>} items 扁平标题列表（文档顺序）
 * @param {Set<string>} collapsedIds 被折叠的标题 id 集合
 * @param {string} activeId 当前激活标题 id
 * @returns {{ visibleItems: Array, displayActiveId: string }}
 *   visibleItems 各项附加 hasChildren / collapsed；
 *   displayActiveId：激活项被折叠隐藏时回退到其最近的可见祖先，用于高亮归属章节。
 */
export const computeTocView = (items, collapsedIds, activeId = '') => {
    const stack = [] // 祖先链（下标栈）
    const parents = new Array(items.length).fill(-1)
    const hidden = new Array(items.length).fill(false)
    const visibleItems = []

    items.forEach((item, index) => {
        while (stack.length && items[stack[stack.length - 1]].level >= item.level) stack.pop()
        const parent = stack.length ? stack[stack.length - 1] : -1
        parents[index] = parent
        hidden[index] = parent >= 0 && (hidden[parent] || collapsedIds.has(items[parent].id))

        if (!hidden[index]) {
            const next = items[index + 1]
            visibleItems.push({
                ...item,
                hasChildren: Boolean(next && next.level > item.level),
                collapsed: collapsedIds.has(item.id)
            })
        }
        stack.push(index)
    })

    let displayActiveId = activeId
    const activeIndex = activeId ? items.findIndex((item) => item.id === activeId) : -1
    if (activeIndex >= 0 && hidden[activeIndex]) {
        let ancestor = parents[activeIndex]
        while (ancestor >= 0 && hidden[ancestor]) ancestor = parents[ancestor]
        if (ancestor >= 0) displayActiveId = items[ancestor].id
    }

    return { visibleItems, displayActiveId }
}

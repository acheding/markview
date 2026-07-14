// 多标签页状态协调（纯逻辑：无 Vue、无 DOM）。
// 把「本页当前内存状态」与「IndexedDB 最新状态（另一标签页刚写入）」协调为一份新状态。
//
// 规则：
//   1. 文档集合与内容以 incoming（持久化真相）为准；
//   2. 数据安全底线——本页活动文档若有未落盘编辑(hasLocalPending)，保留本页版本，
//      保存时以本页为准(last-write-wins)，绝不被别处的写入静默覆盖；
//   3. 本页的活动选择(activeId)尽量保持不变；仅当活动文档在别处被删、且本页无未存改动时才改选。
//
// 返回：
//   state            —— 协调后的 { activeId, files }
//   activeContent    —— 需推回编辑器活动文档的内容（activeId 未变但内容被外部更新时；否则 null）
//   forgetIds        —— 需让编辑器丢弃缓存 EditorState 的文档 id（内容已被外部更新，或成为新活动文档）
export const reconcileDocumentState = ({ current, incoming, hasLocalPending }) => {
    const currentFiles = current?.files || []
    const incomingFiles = incoming?.files || []
    const currentById = new Map(currentFiles.map((file) => [file.id, file]))
    const incomingById = new Map(incomingFiles.map((file) => [file.id, file]))

    const liveId = current?.activeId || ''
    const localActive = currentById.get(liveId) || null
    const incomingActive = incomingById.get(liveId) || null

    let files = incomingFiles.map((file) => ({ ...file }))
    let activeId = liveId
    let activeContent = null

    if (incomingActive) {
        const contentDiffers = Boolean(localActive) && localActive.content !== incomingActive.content
        if (hasLocalPending && contentDiffers) {
            // 保留本页正在编辑、尚未落盘的活动文档
            files = files.map((file) => (file.id === liveId ? { ...localActive } : file))
        } else if (contentDiffers) {
            // 空闲页：采纳别处的最新内容，稍后推回编辑器
            activeContent = incomingActive.content
        }
    } else if (hasLocalPending && localActive) {
        // 活动文档在别处被删，但本页有未落盘编辑：保住它（重新并入并置顶）
        files = [{ ...localActive }, ...files]
    } else {
        // 活动文档在别处被删且本页无改动：跟随改选到别处的活动文档（或第一篇）
        activeId =
            (incoming?.activeId && incomingById.has(incoming.activeId) ? incoming.activeId : '') ||
            (files[0] ? files[0].id : '')
    }

    // 内容被外部更新的文档，其编辑器缓存态已过期，需丢弃以便下次切入时重建。
    const forgetIds = []
    for (const file of incomingFiles) {
        // 当前活动文档若未改选：走 activeContent（同 id 就地替换）或已保留本地，不在此丢弃。
        if (activeId === liveId && file.id === liveId) continue
        const local = currentById.get(file.id)
        if (local && local.content !== file.content) forgetIds.push(file.id)
    }
    // 改选到新活动文档：确保编辑器丢弃其可能过期的缓存态，切入时按新内容重建。
    if (activeId !== liveId && activeId && !forgetIds.includes(activeId)) forgetIds.push(activeId)

    return { state: { activeId, files }, activeContent, forgetIds }
}

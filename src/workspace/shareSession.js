import { nextTick, watch } from 'vue'
import { copyText } from '../composables/clipboard.js'
import { decodeShareHash, encodeSharePayload } from '../core/share/shareLink.js'

// URL 分享会话：把文档压缩进链接 hash（生成端），以及启动时消费 #share= 链接（还原端）。
// 链接自包含、无需后端；带锚点时生成「定位分享链接」，打开后直达对应标题。
export const createShareSession = ({ documents, toast, headings, waitForPreviewReady }) => {
    // 分享链接（#share=…）→ 解压为新文档导入，并清掉 share hash（避免刷新重复导入）。
    // 不在此写回标题锚点：导入会切换活动文档、触发文档切换副作用（含 clearHash），
    // 此刻写的锚点会被清掉。锚点由调用方在切换副作用结束后写回。返回解码结果（含 anchor）。
    const importSharedFromHash = () => {
        const shared = decodeShareHash(window.location.hash)
        if (!shared) return null
        documents.importFile({ name: shared.name, content: shared.content })
        history.replaceState(null, '', window.location.pathname + window.location.search)
        toast.show('已打开分享的文档', { tone: 'success' })
        return shared
    }

    // 把当前文档压缩进 URL hash，复制到剪贴板。
    // 传入 anchor（标题 id）时生成「定位分享链接」：既含原文档、又直达该标题。
    const shareActiveDocument = async (anchor) => {
        // 通过 @click 直接绑定时首参会是 MouseEvent，仅接受字符串锚点。
        const anchorId = typeof anchor === 'string' && anchor ? anchor : null
        const name = documents.activeFile.value?.name || '未命名文档.md'
        const compressed = encodeSharePayload({ name, content: documents.content.value, anchor: anchorId })
        const url = new URL(window.location.href)
        url.hash = `share=${compressed}`
        const link = url.toString()

        if (await copyText(link)) {
            // hash 不会发到服务器，故不受 8KB URL 限制；真正的上限是浏览器地址栏（Safari 约 8 万字符最保守）
            // 与聊天软件粘贴截断，故阈值放宽到 5 万，超出也只是温和提示、仍复制成功。
            const isLong = link.length > 50000
            const label = anchorId ? '定位分享链接' : '分享链接'
            toast.show(isLong ? `${label}已复制（较长，可能被截断）` : `${label}已复制到剪贴板`, {
                tone: 'success',
                duration: isLong ? 3200 : 2200
            })
            return true
        }
        // 复制彻底失败：把链接写进地址栏，用户可手动复制。
        window.location.hash = `share=${compressed}`
        toast.show('已生成链接，请从地址栏手动复制', { tone: 'warning', duration: 3600 })
        return false
    }

    // 数据就绪后：先处理分享链接（导入新文档），待文档切换副作用跑完再写回锚点、等预览发布后定位。
    watch(
        () => documents.isReady.value,
        async (ready) => {
            if (!ready) return
            await nextTick()
            const shared = importSharedFromHash()
            // 等一拍让导入触发的文档切换副作用（含 clearHash、置顶）和重渲染跑完：
            // 之后再写回锚点 hash（否则会被 clearHash 清掉），并等预览真正发布——
            // 否则标题 DOM 尚不存在，定位会落空、或被随后到达的渲染把锚点挤偏一个标题。
            await nextTick()
            if (shared?.anchor) {
                const base = window.location.pathname + window.location.search
                history.replaceState(null, '', `${base}#${encodeURIComponent(shared.anchor)}`)
            }
            await waitForPreviewReady()
            headings.scrollToHashHeading()
        }
    )

    return { shareActiveDocument }
}

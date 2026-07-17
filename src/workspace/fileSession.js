import { computed, ref, watch } from 'vue'
import {
    contentSignature,
    isFileSystemAccessSupported,
    isSameFileEntry,
    isWritableFileHandle,
    pickOpenFiles,
    pickSaveFile,
    queryFilePermission,
    readFileHandle,
    requestFilePermission,
    statFileHandle,
    writeFileHandle
} from '../core/documents/fileAccess.js'
import { getExportFileName, normalizeLineEndings } from '../core/documents/documentModel.js'
import {
    deleteFileHandles,
    isIndexedDbSupported,
    loadFileHandles,
    saveFileHandle
} from '../core/documents/documentStore.js'

// 活动文档相对其关联本地文件的状态（无关联时为 null，UI 走 IndexedDB 自动保存状态）。
export const FILE_LINK_STATUS = {
    SYNCED: 'synced', // 内容与上次写回磁盘时一致
    DIRTY: 'dirty', // 有未写回磁盘的编辑
    WRITING: 'writing', // 正在写入磁盘
    PERMISSION: 'permission', // 跨会话恢复的句柄待重新授权
    MISSING: 'missing' // 磁盘文件已被移动/删除
}

const STATUS_LABEL = {
    [FILE_LINK_STATUS.SYNCED]: '已写回文件',
    [FILE_LINK_STATUS.DIRTY]: '未写回文件',
    [FILE_LINK_STATUS.WRITING]: '正在写入文件',
    [FILE_LINK_STATUS.PERMISSION]: '重新授权文件访问',
    [FILE_LINK_STATUS.MISSING]: '本地文件已丢失'
}

// 磁盘文件会话：把文档与 FileSystemFileHandle 关联起来，实现「打开本地文件 → 编辑 → Ctrl+S 写回」。
// 职责：句柄注册表（内存 + IndexedDB 持久化）、写回/另存为、跨会话权限恢复、
// 外部修改检测（focus/切换文档时对比磁盘 mtime）、同一磁盘文件去重（isSameEntry）。
// 不支持 File System Access API（Firefox/Safari）时 isSupported 为 false，入口全部降级为导入副本/下载导出。
//
// link meta 语义：
//   savedSignature —— 上次与磁盘对齐时文档内容的签名；null = 基线未知（跨会话恢复后尚未与磁盘核对）。
//   lastModified   —— 上次读/写时磁盘文件的 mtime；null = 尚未核对。两者配合区分「本地脏」与「磁盘变了」。
export const createFileSession = ({ documents, toast, confirm, getEditor }) => {
    const isSupported = isFileSystemAccessSupported()
    const canPersistHandles = isIndexedDbSupported()

    const handles = new Map() // docId → FileSystemFileHandle（句柄不可比较内容，不进响应式状态）
    const links = ref({}) // docId → link meta（整体替换以触发响应）

    let ready = false
    let readyWaiters = []
    let checking = false
    let refreshQueued = false

    const whenReady = () => (ready ? Promise.resolve() : new Promise((resolve) => readyWaiters.push(resolve)))
    const markReady = () => {
        ready = true
        readyWaiters.forEach((resolve) => resolve())
        readyWaiters = []
    }

    const getDocById = (docId) => documents.files.value.find((file) => file.id === docId)

    const updateLink = (docId, patch) => {
        const current = links.value[docId]
        if (!current) return
        links.value = { ...links.value, [docId]: { ...current, ...patch } }
    }

    const mountLink = (docId, meta) => {
        links.value = {
            ...links.value,
            [docId]: {
                name: '',
                permission: 'granted',
                savedSignature: null,
                lastModified: null,
                writing: false,
                missing: false,
                missingPrompted: false,
                ...meta
            }
        }
    }

    const dropLinks = (docIds) => {
        if (!docIds.length) return
        const next = { ...links.value }
        docIds.forEach((docId) => delete next[docId])
        links.value = next
    }

    // —— 对外响应式状态 ——
    const isLinked = (docId) => Boolean(links.value[docId])
    const activeLink = computed(() => links.value[documents.activeFileId.value] || null)

    const activeStatus = computed(() => {
        const link = activeLink.value
        if (!link) return null
        if (link.writing) return FILE_LINK_STATUS.WRITING
        if (link.permission !== 'granted') return FILE_LINK_STATUS.PERMISSION
        if (link.missing) return FILE_LINK_STATUS.MISSING
        return link.savedSignature !== null && contentSignature(documents.content.value) === link.savedSignature
            ? FILE_LINK_STATUS.SYNCED
            : FILE_LINK_STATUS.DIRTY
    })
    const activeStatusLabel = computed(() => STATUS_LABEL[activeStatus.value] || '')

    // —— 关联建立 / 清理 ——
    const establishLink = (docId, handle, meta = {}) => {
        handles.set(docId, handle)
        mountLink(docId, { name: handle.name || '', ...meta })
        if (!canPersistHandles) return
        // 持久化失败（隐私模式等）不影响会话内写回，降级为仅本次会话有效。
        saveFileHandle(docId, handle).catch((error) => console.warn('文件句柄持久化失败:', error))
    }

    const detachLink = async (docId) => {
        handles.delete(docId)
        dropLinks([docId])
        if (!canPersistHandles) return
        try {
            await deleteFileHandles([docId])
        } catch (error) {
            console.warn('取消文件关联失败:', error)
        }
    }

    // 磁盘内容进入文档状态前统一走行尾归一化（与导入一致），签名基于归一化后的内容。
    const reloadFromDisk = (docId, diskContent, { name, lastModified }) => {
        const normalized = normalizeLineEndings(diskContent)
        documents.replaceContent(docId, normalized)
        if (documents.activeFileId.value === docId) getEditor()?.setDoc(normalized)
        else getEditor()?.forgetDocument(docId)
        updateLink(docId, {
            savedSignature: contentSignature(normalized),
            lastModified,
            name: name || links.value[docId]?.name,
            missing: false,
            missingPrompted: false
        })
    }

    // 文件句柄因磁盘文件被移动、重命名或删除而失效时，提示用户处置：
    // 确认 = 另存到新位置（转移关联）；取消按钮 = 取消关联、仅保留在 MarkView；
    // Esc / 点遮罩 = 未做选择——保持丢失标记，稍后可点击头部「本地文件已丢失」标签再处理。
    // 自动检查每次丢失只提示一次，避免 focus/visibilitychange 反复打扰；显式 Ctrl+S / 点标签可强制再次提示。
    const handleMissingFile = async (docId, { forcePrompt = false } = {}) => {
        const link = links.value[docId]
        if (!link) return 'failed'

        const shouldPrompt = forcePrompt || !link.missing || !link.missingPrompted
        updateLink(docId, { missing: true, missingPrompted: true })
        if (!shouldPrompt) return 'failed'

        const choice = await confirm.ask({
            title: '本地文件已丢失',
            message: `无法访问「${link.name}」。文件可能已被移动、重命名或删除，当前编辑仍保存在 MarkView 中，可另存到新的位置。`,
            confirmLabel: '另存为本地文件',
            cancelLabel: '仅保留在 MarkView'
        })
        if (choice === true) {
            if (documents.activeFileId.value !== docId) return 'failed'
            return saveActiveAs()
        }
        // 关掉对话框（Esc / 点遮罩）＝暂不处置：保留失效关联，不静默改变文档归属。
        if (choice !== false) return 'failed'

        // 工作副本本就由 documentSession 自动保存；此处先显式落盘，再清除失效句柄。
        await documents.flush()
        await detachLink(docId)
        toast.show(`已取消与「${link.name}」的关联，文档将继续保存在 MarkView 中`, {
            tone: 'success',
            duration: 3200
        })
        return 'detached'
    }

    // 头部「本地文件已丢失」状态标签的点击入口：重新唤起处置弹窗（另存 / 取消关联）。
    const resolveMissingFile = () => handleMissingFile(documents.activeFileId.value, { forcePrompt: true })

    // —— 外部修改检测 ——
    // 时机：窗口 focus / 回到前台 / 切换文档。只检测活动文档，checking 防并发重入。
    // 基线未知（跨会话恢复后首次核对）时同样在此收敛：内容一致→静默对齐；不一致→交由用户决策。
    const checkActiveExternal = async () => {
        const docId = documents.activeFileId.value
        const link = links.value[docId]
        const handle = handles.get(docId)
        if (!link || !handle || checking || link.writing || link.permission !== 'granted') return

        checking = true
        try {
            // 快路径：mtime 未变即无外部修改，不读内容。
            if (link.lastModified !== null) {
                const stat = await statFileHandle(handle)
                if (stat.lastModified === link.lastModified) {
                    if (link.missing) updateLink(docId, { missing: false, missingPrompted: false })
                    return
                }
            }

            const { name, content, lastModified } = await readFileHandle(handle)
            const doc = getDocById(docId)
            if (!doc) return

            const diskNormalized = normalizeLineEndings(content)
            if (diskNormalized === doc.content) {
                // 内容一致（mtime 变化来自外部 touch 或基线核对）：对齐基线即可。
                updateLink(docId, {
                    savedSignature: contentSignature(doc.content),
                    lastModified,
                    name,
                    missing: false,
                    missingPrompted: false
                })
                return
            }

            const localClean = link.savedSignature !== null && contentSignature(doc.content) === link.savedSignature
            if (localClean) {
                // 本地自上次同步后没动过：安全地跟进磁盘版本。
                reloadFromDisk(docId, content, { name, lastModified })
                toast.show(`已加载「${name}」的最新内容`, { tone: 'success' })
                return
            }

            // 双方都有变化（或基线未知且内容不一致）：让用户决策，绝不静默丢弃任何一方。
            const loadDisk = await confirm.ask({
                title: '文件已被外部修改',
                message: `「${name}」本地文件的内容与当前文档不一致。加载文件版本将丢弃当前未写回的编辑；保留当前内容则可稍后用 Ctrl+S 写回覆盖。`,
                confirmLabel: '加载文件版本',
                cancelLabel: '保留当前内容',
                tone: 'danger'
            })
            if (loadDisk) {
                reloadFromDisk(docId, content, { name, lastModified })
            } else {
                // 对齐 mtime：这次外部修改已知悉，后续 Ctrl+S 直接覆盖、不再重复弹窗。
                updateLink(docId, { lastModified, name, missing: false, missingPrompted: false })
            }
        } catch (error) {
            if (error?.name === 'NotAllowedError' || error?.name === 'SecurityError') {
                updateLink(docId, { permission: 'prompt' })
            } else if (error?.name === 'NotFoundError') {
                await handleMissingFile(docId)
            } else {
                console.warn('外部修改检测失败:', error)
            }
        } finally {
            checking = false
        }
    }

    // —— 写回 ——
    const saveActiveToFile = async () => {
        const docId = documents.activeFileId.value
        const link = links.value[docId]
        const handle = handles.get(docId)
        if (!link || !handle) return 'no-link'
        if (link.writing) return 'busy'

        // Ctrl+S 的 keydown 是用户手势，可直接请求权限（跨会话恢复的句柄默认 prompt）。
        if (link.permission !== 'granted') {
            const permission = await requestFilePermission(handle).catch(() => 'denied')
            updateLink(docId, { permission })
            if (permission !== 'granted') {
                toast.show('未获得文件写入权限，可用「另存为本地文件」保存', { tone: 'warning', duration: 3000 })
                return 'denied'
            }
        }

        // 写回前快检：磁盘在别处被修改过则先确认，避免静默覆盖外部编辑。
        try {
            const stat = await statFileHandle(handle)
            if (link.lastModified !== null && stat.lastModified !== link.lastModified) {
                const { content: diskContent } = await readFileHandle(handle)
                const doc = getDocById(docId)
                if (normalizeLineEndings(diskContent) !== doc?.content) {
                    const overwrite = await confirm.ask({
                        title: '本地文件已更新',
                        message: `「${link.name}」已被其他程序修改，写回将覆盖这些修改。`,
                        confirmLabel: '仍然写回',
                        cancelLabel: '取消',
                        tone: 'danger'
                    })
                    if (!overwrite) return 'canceled'
                }
            }
        } catch (error) {
            if (error?.name === 'NotFoundError') {
                return handleMissingFile(docId, { forcePrompt: true })
            }
            // 快检失败不阻塞写回，交由写入本身报错。
        }

        updateLink(docId, { writing: true })
        // 确认框是异步的，内容以落笔瞬间为准。
        const content = getDocById(docId)?.content ?? ''
        try {
            const { lastModified } = await writeFileHandle(handle, content)
            updateLink(docId, {
                writing: false,
                savedSignature: contentSignature(content),
                lastModified,
                permission: 'granted',
                missing: false,
                missingPrompted: false
            })
            toast.show(`已写回 ${link.name}`, { tone: 'success' })
            return 'saved'
        } catch (error) {
            const patch = { writing: false }
            if (error?.name === 'NotAllowedError' || error?.name === 'SecurityError') patch.permission = 'prompt'
            updateLink(docId, patch)
            console.warn('写回文件失败:', error)
            if (error?.name === 'NotFoundError') {
                return handleMissingFile(docId, { forcePrompt: true })
            }
            toast.show('写回文件失败，请重试或使用「另存为本地文件」', { tone: 'error', duration: 3600 })
            return 'failed'
        }
    }

    // —— 另存为 ——
    // 把活动文档写入用户选择的磁盘位置并建立关联；文档改随磁盘文件名。
    const saveActiveAs = async () => {
        if (!isSupported) return 'unsupported'
        const doc = documents.activeFile.value
        if (!doc) return 'no-doc'

        let handle
        try {
            handle = await pickSaveFile(getExportFileName(doc.name))
        } catch (error) {
            console.warn('另存为失败:', error)
            toast.show('另存为失败，请重试', { tone: 'error', duration: 3000 })
            return 'failed'
        }
        if (!handle) return 'canceled'

        const content = getDocById(doc.id)?.content ?? ''
        try {
            const { lastModified } = await writeFileHandle(handle, content)
            establishLink(doc.id, handle, {
                savedSignature: contentSignature(content),
                lastModified
            })
            documents.setDocumentName(doc.id, handle.name)
            toast.show(`已保存到 ${handle.name}`, { tone: 'success' })
            return 'saved'
        } catch (error) {
            console.warn('另存为写入失败:', error)
            toast.show('写入文件失败，请重试', { tone: 'error', duration: 3000 })
            return 'failed'
        }
    }

    // —— 打开（launchQueue 双击 / Ctrl+O 选择器共用） ——
    const findLinkedDocId = async (handle) => {
        for (const [docId, existing] of handles) {
            if (await isSameFileEntry(existing, handle)) return docId
        }
        return null
    }

    const openViaHandles = async (incoming = []) => {
        const list = Array.from(incoming || [])
        if (!list.length) return
        await whenReady()

        let opened = 0
        let switched = 0
        let failed = 0

        for (const handle of list) {
            try {
                // 同一磁盘文件已打开：切换过去并核对最新内容，不再导入副本。
                const linkedId = await findLinkedDocId(handle)
                if (linkedId && getDocById(linkedId)) {
                    documents.select(linkedId)
                    await checkActiveExternal()
                    switched += 1
                    continue
                }

                const { name, content, lastModified } = await readFileHandle(handle)
                const docId = documents.importFile({ content })
                // 先建关联再命名：关联后名字被锁定，setDocumentName 直接沿用磁盘文件名
                // （不参与重名加序号，可与普通文档重名）；只读句柄降级为普通导入副本，
                // 不建关联，命名走普通文档的去重老规则。
                if (isWritableFileHandle(handle)) {
                    establishLink(docId, handle, {
                        savedSignature: contentSignature(normalizeLineEndings(content)),
                        lastModified
                    })
                }
                documents.setDocumentName(docId, name)
                opened += 1
            } catch (error) {
                console.warn('打开文件失败:', error)
                failed += 1
            }
        }

        const succeeded = opened + switched
        if (succeeded && failed) {
            toast.show(`已打开 ${succeeded} 个文件，${failed} 个失败`, { tone: 'warning', duration: 3000 })
        } else if (failed) {
            toast.show(`${failed} 个文件打开失败`, { tone: 'error', duration: 3000 })
        } else if (switched && !opened) {
            toast.show('文件已打开，已切换到对应文档', { tone: 'success' })
        } else if (succeeded) {
            toast.show(succeeded > 1 ? `已打开 ${succeeded} 个文件` : '已打开文件', { tone: 'success' })
        }
    }

    const openFilePicker = async () => {
        if (!isSupported) return
        try {
            const picked = await pickOpenFiles()
            if (picked.length) await openViaHandles(picked)
        } catch (error) {
            console.warn('打开文件选择器失败:', error)
            toast.show('打开文件失败，请重试', { tone: 'error', duration: 3000 })
        }
    }

    // —— 权限恢复（状态标签点击，用户手势内） ——
    const requestActivePermission = async () => {
        const docId = documents.activeFileId.value
        const handle = handles.get(docId)
        if (!handle || !links.value[docId]) return
        const permission = await requestFilePermission(handle).catch(() => 'denied')
        updateLink(docId, { permission })
        if (permission === 'granted') {
            toast.show('已恢复文件访问', { tone: 'success' })
            checkActiveExternal()
        } else {
            toast.show('未获得文件访问权限', { tone: 'warning', duration: 3000 })
        }
    }

    // —— 启动装载：文档 hydrate 完成后恢复持久化句柄 ——
    const init = async () => {
        if (!isSupported || !canPersistHandles) {
            markReady()
            return
        }

        try {
            const stored = await loadFileHandles()
            const orphaned = [...stored.keys()].filter((docId) => !getDocById(docId))
            if (orphaned.length) deleteFileHandles(orphaned).catch(() => {})

            const next = { ...links.value }
            for (const [docId, handle] of stored) {
                if (!getDocById(docId) || !isWritableFileHandle(handle) || handles.has(docId)) continue
                handles.set(docId, handle)
                next[docId] = {
                    name: handle.name || '',
                    permission: await queryFilePermission(handle).catch(() => 'prompt'),
                    // 基线未知：上次会话结束后磁盘/文档谁更新无从判断，交给首次外部核对收敛。
                    savedSignature: null,
                    lastModified: null,
                    writing: false,
                    missing: false,
                    missingPrompted: false
                }
            }
            links.value = next
        } catch (error) {
            console.warn('恢复文件句柄失败:', error)
        }

        markReady()
        checkActiveExternal()
    }

    // 另一窗口新打开的关联文档经多标签页协调到达本页：补载其句柄（去抖合并）。
    const scheduleLinkRefresh = () => {
        if (refreshQueued || !isSupported || !canPersistHandles) return
        refreshQueued = true
        setTimeout(async () => {
            refreshQueued = false
            try {
                const stored = await loadFileHandles()
                const next = { ...links.value }
                let touched = false
                for (const [docId, handle] of stored) {
                    if (handles.has(docId) || !isWritableFileHandle(handle) || !getDocById(docId)) continue
                    handles.set(docId, handle)
                    next[docId] = {
                        name: handle.name || '',
                        permission: await queryFilePermission(handle).catch(() => 'prompt'),
                        savedSignature: null,
                        lastModified: null,
                        writing: false,
                        missing: false,
                        missingPrompted: false
                    }
                    touched = true
                }
                if (touched) links.value = next
            } catch (error) {
                console.warn('刷新文件句柄失败:', error)
            }
        }, 0)
    }

    // 文档集合结构变化（本页删除 / 别页经 reconcile 增删）：清理消失文档的句柄、补载新到文档的句柄。
    // 以 id 串为源确保 unshift/splice 等就地变更也能触发。
    let prevIds = new Set()
    watch(
        () => documents.files.value.map((file) => file.id).join('|'),
        (joined) => {
            const ids = new Set(joined ? joined.split('|') : [])
            if (ready) {
                const vanished = [...handles.keys()].filter((docId) => !ids.has(docId))
                if (vanished.length) {
                    vanished.forEach((docId) => handles.delete(docId))
                    dropLinks(vanished)
                    if (canPersistHandles) {
                        deleteFileHandles(vanished).catch((error) => console.warn('清理文件句柄失败:', error))
                    }
                }
                if ([...ids].some((docId) => !prevIds.has(docId))) scheduleLinkRefresh()
            }
            prevIds = ids
        },
        { immediate: true }
    )

    return {
        isSupported,
        isLinked,
        activeLink,
        activeStatus,
        activeStatusLabel,
        init,
        openFilePicker,
        openViaHandles,
        saveActiveToFile,
        saveActiveAs,
        requestActivePermission,
        resolveMissingFile,
        checkActiveExternal
    }
}

// 保存状态机：防抖调度 + revision 防竞态 + Promise 链串行化写入。
// 存储实现（save）与快照来源（getSnapshot）以参数注入，不依赖 Vue 与 DOM。

export const SAVE_STATUS = {
    SAVED: 'saved',
    UNSAVED: 'unsaved',
    SAVING: 'saving',
    FAILED: 'failed',
    MEMORY_ONLY: 'memory-only'
}

const DEFAULT_DEBOUNCE_MS = 800

export const createPersistenceScheduler = ({
    getSnapshot,
    save,
    canPersist = true,
    debounceMs = DEFAULT_DEBOUNCE_MS,
    onStatus = () => {}
}) => {
    let enabled = false
    let persistable = canPersist
    let saveTimer = null
    let saveChain = Promise.resolve()
    let saveRevision = 0
    let hasPendingSave = false

    const setStatus = (status) => onStatus(status)

    const setPendingStatus = () => {
        setStatus(persistable ? SAVE_STATUS.UNSAVED : SAVE_STATUS.MEMORY_ONLY)
    }

    const enqueueSave = (snapshot, revision) => {
        saveChain = saveChain
            .catch(() => {})
            .then(async () => {
                if (!persistable) {
                    setStatus(SAVE_STATUS.MEMORY_ONLY)
                    return
                }

                setStatus(SAVE_STATUS.SAVING)

                try {
                    await save(snapshot)
                    if (saveRevision === revision) {
                        hasPendingSave = false
                        setStatus(SAVE_STATUS.SAVED)
                    }
                } catch (error) {
                    setStatus(SAVE_STATUS.FAILED)
                    console.warn('IndexedDB 写入失败:', error)
                }
            })

        return saveChain
    }

    // 记录一次待保存的变更并重置防抖计时；delay=0 用于切换/新建/删除等需立即落盘的操作。
    const schedule = ({ delay = debounceMs } = {}) => {
        if (!enabled) return

        hasPendingSave = true
        saveRevision += 1
        setPendingStatus()
        clearTimeout(saveTimer)

        saveTimer = setTimeout(() => {
            saveTimer = null
            enqueueSave(getSnapshot(), saveRevision)
        }, delay)
    }

    // 立即落盘；markDirty 表示调用方刚做了一次未经过 schedule 的变更（如文件名派生）。
    const flush = ({ markDirty = false } = {}) => {
        if (markDirty && enabled) {
            hasPendingSave = true
            saveRevision += 1
            setPendingStatus()
        }

        clearTimeout(saveTimer)
        saveTimer = null

        if (!enabled || !hasPendingSave) return saveChain

        return enqueueSave(getSnapshot(), saveRevision)
    }

    return {
        schedule,
        flush,
        // 是否存在尚未落盘的变更（多标签页协调时用于保护本页正在编辑的活动文档）。
        hasPending: () => hasPendingSave,
        setEnabled(value) {
            enabled = Boolean(value)
        },
        setCanPersist(value) {
            persistable = Boolean(value)
        },
        dispose() {
            clearTimeout(saveTimer)
            saveTimer = null
        }
    }
}

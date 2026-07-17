// IndexedDB 文档存储：支持更大的文档集合。
// 每个文档单独一条记录，配合增量写入，避免每次保存都序列化整个集合。
// v2：新增 fileHandles 表，持久化文档关联的 FileSystemFileHandle（结构化克隆存储），
// 与文档主表分离——句柄无法参与内容签名比较，不能混进增量写入的 documents 表。
const DB_NAME = 'markview-db'
const DB_VERSION = 2
const DOC_STORE = 'documents'
const META_STORE = 'meta'
const HANDLE_STORE = 'fileHandles'
const ACTIVE_ID_KEY = 'activeId'
const ORDER_KEY = 'order'

let dbPromise = null
let lastPersisted = new Map()

export const isIndexedDbSupported = () => typeof indexedDB !== 'undefined'

const openDb = () => {
    if (dbPromise) return dbPromise

    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION)

        request.onupgradeneeded = () => {
            const db = request.result
            if (!db.objectStoreNames.contains(DOC_STORE)) {
                db.createObjectStore(DOC_STORE, { keyPath: 'id' })
            }
            if (!db.objectStoreNames.contains(META_STORE)) {
                db.createObjectStore(META_STORE, { keyPath: 'key' })
            }
            if (!db.objectStoreNames.contains(HANDLE_STORE)) {
                db.createObjectStore(HANDLE_STORE, { keyPath: 'docId' })
            }
        }

        request.onsuccess = () => resolve(request.result)
        request.onerror = () => {
            dbPromise = null
            reject(request.error)
        }
        request.onblocked = () => {
            dbPromise = null
            reject(new Error('IndexedDB 打开被阻塞'))
        }
    })

    return dbPromise
}

const requestToPromise = (request) =>
    new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
    })

const txDone = (transaction) =>
    new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => reject(transaction.error)
        transaction.onabort = () => reject(transaction.error || new Error('IndexedDB 事务被中止'))
    })

const toPlainDocument = (doc) => ({
    id: doc.id,
    name: doc.name,
    content: doc.content,
    updatedAt: doc.updatedAt
})

const hashString = (value = '') => {
    let hash = 2166136261
    const text = String(value)

    for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index)
        hash = Math.imul(hash, 16777619)
    }

    return (hash >>> 0).toString(36)
}

const fieldSignature = (value = '') => {
    const text = String(value)

    return `${text.length}:${hashString(text)}`
}

const signatureOf = (doc) => [doc.updatedAt, fieldSignature(doc.name), fieldSignature(doc.content)].join('#')

const sortByOrder = (docs, order) => {
    const rank = new Map(order.map((id, index) => [id, index]))
    return [...docs].sort(
        (a, b) =>
            (rank.has(a.id) ? rank.get(a.id) : Number.MAX_SAFE_INTEGER) -
            (rank.has(b.id) ? rank.get(b.id) : Number.MAX_SAFE_INTEGER)
    )
}

const loadAllDocuments = async () => {
    const db = await openDb()
    const store = db.transaction(DOC_STORE, 'readonly').objectStore(DOC_STORE)
    return requestToPromise(store.getAll())
}

const loadMetaValue = async (key, fallbackValue) => {
    const db = await openDb()
    const store = db.transaction(META_STORE, 'readonly').objectStore(META_STORE)
    const record = await requestToPromise(store.get(key))
    return record?.value ?? fallbackValue
}

const markPersisted = (files) => {
    lastPersisted = new Map(files.map((file) => [file.id, signatureOf(file)]))
}

export const loadDocumentState = async () => {
    const docs = await loadAllDocuments()
    if (!docs.length) {
        lastPersisted = new Map()
        return null
    }

    const [activeId, order] = await Promise.all([loadMetaValue(ACTIVE_ID_KEY, ''), loadMetaValue(ORDER_KEY, [])])
    const files = sortByOrder(docs, Array.isArray(order) ? order : [])

    markPersisted(files)

    return { activeId, files }
}

export const saveDocumentState = async ({ activeId, files }) => {
    const nextPersisted = new Map()
    const puts = []
    const deletes = []

    files.forEach((file) => {
        const signature = signatureOf(file)
        nextPersisted.set(file.id, signature)
        if (lastPersisted.get(file.id) !== signature) {
            puts.push(file)
        }
    })

    lastPersisted.forEach((_signature, id) => {
        if (!nextPersisted.has(id)) deletes.push(id)
    })

    const db = await openDb()
    const transaction = db.transaction([DOC_STORE, META_STORE], 'readwrite')
    const docStore = transaction.objectStore(DOC_STORE)
    const metaStore = transaction.objectStore(META_STORE)

    puts.forEach((doc) => docStore.put(toPlainDocument(doc)))
    deletes.forEach((id) => docStore.delete(id))

    metaStore.put({ key: ACTIVE_ID_KEY, value: activeId })
    metaStore.put({ key: ORDER_KEY, value: files.map((file) => file.id) })

    await txDone(transaction)
    lastPersisted = nextPersisted
}

// —— 文件句柄持久化 ——
// FileSystemFileHandle 可结构化克隆，直接整体存取；跨会话恢复后权限需重新请求（见 fileSession）。

export const loadFileHandles = async () => {
    const db = await openDb()
    const store = db.transaction(HANDLE_STORE, 'readonly').objectStore(HANDLE_STORE)
    const records = await requestToPromise(store.getAll())
    return new Map(records.map((record) => [record.docId, record.handle]))
}

export const saveFileHandle = async (docId, handle) => {
    const db = await openDb()
    const transaction = db.transaction(HANDLE_STORE, 'readwrite')
    transaction.objectStore(HANDLE_STORE).put({ docId, handle })
    await txDone(transaction)
}

export const deleteFileHandles = async (docIds) => {
    if (!docIds?.length) return
    const db = await openDb()
    const transaction = db.transaction(HANDLE_STORE, 'readwrite')
    const store = transaction.objectStore(HANDLE_STORE)
    docIds.forEach((docId) => store.delete(docId))
    await txDone(transaction)
}

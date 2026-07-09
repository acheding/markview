// IndexedDB 文档存储：支持更大的文档集合。
// 每个文档单独一条记录，配合增量写入，避免每次保存都序列化整个集合。
const DB_NAME = 'markview-db'
const DB_VERSION = 1
const DOC_STORE = 'documents'
const META_STORE = 'meta'
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

const requestToPromise = (request) => new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
})

const txDone = (transaction) => new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error || new Error('IndexedDB 事务被中止'))
})

const toPlainDocument = (doc) => ({
    id: doc.id,
    name: doc.name,
    content: doc.content,
    updatedAt: doc.updatedAt,
})

const signatureOf = (doc) => `${doc.updatedAt}#${doc.content.length}`

const sortByOrder = (docs, order) => {
    const rank = new Map(order.map((id, index) => [id, index]))
    return [...docs].sort((a, b) => (
        (rank.has(a.id) ? rank.get(a.id) : Number.MAX_SAFE_INTEGER)
        - (rank.has(b.id) ? rank.get(b.id) : Number.MAX_SAFE_INTEGER)
    ))
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

    const [activeId, order] = await Promise.all([
        loadMetaValue(ACTIVE_ID_KEY, ''),
        loadMetaValue(ORDER_KEY, []),
    ])
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

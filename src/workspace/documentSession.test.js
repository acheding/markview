import { describe, expect, it } from 'vitest'
import { createDocumentSession } from './documentSession.js'

// node 环境无 indexedDB：hydrate 走纯内存路径（MEMORY_ONLY），正适合直测命名规则。
// isNameLocked 以可变 Set 注入，模拟 fileSession 的「关联即锁名」。
const makeSession = async () => {
    const linked = new Set()
    const session = createDocumentSession({ isNameLocked: (id) => linked.has(id) })
    await session.hydrate()
    return { session, linked }
}

const nameOf = (session, id) => session.files.value.find((file) => file.id === id)?.name

describe('文档命名规则', () => {
    it('普通文档沿用老一套：重名自动加序号', async () => {
        const { session } = await makeSession()
        const first = session.importFile({ content: '# 笔记' })
        const second = session.importFile({ content: '# 笔记' })

        expect(nameOf(session, first)).toBe('笔记.md')
        expect(nameOf(session, second)).toBe('笔记 2.md')
    })

    it('锁定名（关联本地文件）的文档命名不去重，可与普通文档重名', async () => {
        const { session, linked } = await makeSession()
        const plain = session.importFile({ content: '# 笔记' })
        const linkedDoc = session.importFile({ content: '正文' })
        linked.add(linkedDoc)

        session.setDocumentName(linkedDoc, '笔记.md')

        expect(nameOf(session, plain)).toBe('笔记.md')
        expect(nameOf(session, linkedDoc)).toBe('笔记.md')
    })

    it('锁定名的文档不参与内容派生改名；解除锁定后恢复派生', async () => {
        const { session, linked } = await makeSession()
        const id = session.importFile({ content: '# 原始标题' })
        linked.add(id)
        session.setDocumentName(id, '磁盘名.md')

        session.setContent('# 改了标题')
        session.flush()
        expect(nameOf(session, id)).toBe('磁盘名.md')

        // 取消关联（如文件丢失后选择仅保留在浏览器）：回归内容派生命名
        linked.delete(id)
        session.setContent('# 新标题')
        session.flush()
        expect(nameOf(session, id)).toBe('新标题.md')
    })

    it('普通文档的去重集合包含关联文档名：派生撞名时避让加序号', async () => {
        const { session, linked } = await makeSession()
        const linkedDoc = session.importFile({ content: '正文' })
        linked.add(linkedDoc)
        session.setDocumentName(linkedDoc, '周报.md')

        const plain = session.importFile({ content: '# 周报' })

        expect(nameOf(session, plain)).toBe('周报 2.md')
    })
})

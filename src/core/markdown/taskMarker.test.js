import { describe, expect, it } from 'vitest'
import { findTaskMarker } from './taskMarker.js'

describe('findTaskMarker', () => {
    it('定位无序任务项的状态字符区间', () => {
        expect(findTaskMarker('- [ ] 待办')).toEqual({ from: 3, to: 4, checked: false })
        expect(findTaskMarker('* [x] 已完成')).toEqual({ from: 3, to: 4, checked: true })
        expect(findTaskMarker('+ [X] 大写也算已完成')).toEqual({ from: 3, to: 4, checked: true })
    })

    it('支持缩进（嵌套项）与有序列表符号', () => {
        expect(findTaskMarker('    - [ ] 子任务')).toEqual({ from: 7, to: 8, checked: false })
        expect(findTaskMarker('1. [ ] 有序任务')).toEqual({ from: 4, to: 5, checked: false })
        expect(findTaskMarker('12) [x] 有序任务')).toEqual({ from: 5, to: 6, checked: true })
    })

    it('非任务行返回 null（回写闸门：行内容对不上就放弃改写）', () => {
        expect(findTaskMarker('- 普通列表项')).toBeNull()
        expect(findTaskMarker('普通段落 [ ] 不是任务')).toBeNull()
        expect(findTaskMarker('- [y] 非法状态字符')).toBeNull()
        expect(findTaskMarker('- [ ]缺少后置空白')).toBeNull()
        expect(findTaskMarker('')).toBeNull()
    })
})

import { describe, expect, it } from 'vitest'
import { createSlugger } from './slugger.js'

describe('createSlugger', () => {
    it('creates stable unique heading slugs', () => {
        const slug = createSlugger()

        expect(slug('安装 & 使用')).toBe('安装-使用')
        expect(slug('安装 & 使用')).toBe('安装-使用-1')
        expect(slug('***')).toBe('heading')
    })
})

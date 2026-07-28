import { describe, expect, it } from 'vitest'
import { resolveBalancedPaneSnap } from './layoutSession.js'

describe('resolveBalancedPaneSnap', () => {
    it('snaps to the balanced width within the entry distance', () => {
        expect(resolveBalancedPaneSnap(491, 500, false)).toEqual({ width: 500, snapped: true })
    })

    it('does not snap before reaching the entry distance', () => {
        expect(resolveBalancedPaneSnap(489, 500, false)).toEqual({ width: 489, snapped: false })
    })

    it('uses a wider release distance while already snapped', () => {
        expect(resolveBalancedPaneSnap(483, 500, true)).toEqual({ width: 500, snapped: true })
        expect(resolveBalancedPaneSnap(481, 500, true)).toEqual({ width: 481, snapped: false })
    })
})

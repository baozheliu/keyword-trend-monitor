import { describe, expect, it } from 'vitest'
import { robustScore, MAX_ROBUST_SCORE } from '../../src/core/stats/robust'
import { ewmaChart, ewmaSeries } from '../../src/core/stats/ewma'
import { cusum } from '../../src/core/stats/cusum'
import { movingAverage } from '../../src/core/stats/movingAverage'
import { detectCrossover } from '../../src/core/stats/crossover'
import { fallingDays, risingDays, trailingStreak } from '../../src/core/stats/streaks'
import { detectChangepoints, recentChangepoint } from '../../src/core/stats/changepoint'

describe('robustScore', () => {
  it('returns null for an empty baseline', () => {
    expect(robustScore(5, [])).toBeNull()
  })

  it('is 0 when x equals the baseline median', () => {
    expect(robustScore(2, [1, 2, 3])).toBe(0)
  })

  it('is sigma-consistent for normal-ish data', () => {
    // baseline median 2, MAD 1 → scale 1.4826; x = 2 + 2*1.4826
    const baseline = [1, 1, 2, 2, 4, 6, 9].map(v => v - 0) // median 2, mad 1
    const x = 2 + 2 * 1.4826
    expect(robustScore(x, baseline)).toBeCloseTo(2, 6)
  })

  it('detects spikes on constant baselines via the floor scale', () => {
    const score = robustScore(50, [5, 5, 5, 5, 5])
    expect(score).toBe(MAX_ROBUST_SCORE)
  })

  it('handles zero baselines and negative values', () => {
    expect(robustScore(0, [0, 0, 0])).toBe(0)
    const score = robustScore(-10, [0, 0, 0])
    expect(score).toBe(-MAX_ROBUST_SCORE)
  })
})

describe('ewmaSeries', () => {
  it('rejects invalid alpha', () => {
    expect(() => ewmaSeries([1], 0)).toThrow(RangeError)
    expect(() => ewmaSeries([1], 1.5)).toThrow(RangeError)
  })

  it('matches hand-computed values (alpha = 0.5)', () => {
    // e1 = 2, e2 = 0.5*4 + 0.5*2 = 3, e3 = 0.5*6 + 0.5*3 = 4.5
    expect(ewmaSeries([2, 4, 6], 0.5)).toEqual([2, 3, 4.5])
  })

  it('carries values across nulls without decaying', () => {
    expect(ewmaSeries([2, null, 4], 0.5)).toEqual([2, 2, 3])
  })

  it('handles empty and all-null input', () => {
    expect(ewmaSeries([], 0.3)).toEqual([])
    expect(ewmaSeries([null, null], 0.3)).toEqual([null, null])
  })
})

describe('ewmaChart', () => {
  it('returns null when no valid recent points exist', () => {
    expect(ewmaChart([null, null], 10, 2)).toBeNull()
  })

  it('standardises with the asymptotic EWMA sigma', () => {
    // constant recent = mean → z = 0
    const result = ewmaChart([10, 10, 10], 10, 2, 0.3)
    expect(result).not.toBeNull()
    expect(result!.z).toBeCloseTo(0, 9)
  })

  it('produces large z for a strong shift', () => {
    const result = ewmaChart([20, 22, 24, 26], 10, 1, 0.3)
    expect(result!.z).toBeGreaterThan(3)
  })

  it('does not explode when the baseline scale is 0', () => {
    const result = ewmaChart([12, 12], 10, 0)
    expect(Number.isFinite(result!.z)).toBe(true)
    expect(result!.z).toBeGreaterThan(0)
  })
})

describe('cusum', () => {
  it('stays at zero for on-target data', () => {
    const { high, low } = cusum([10, 10, 10, 10], 10, 1)
    expect(high).toBe(0)
    expect(low).toBe(0)
  })

  it('accumulates for a persistent upward shift (k = 0.5)', () => {
    // z = +2 each point → high += 1.5 per point
    const { high, low } = cusum([12, 12, 12, 12], 10, 1)
    expect(high).toBeCloseTo(6, 9)
    expect(low).toBe(0)
  })

  it('accumulates the low side for downward shifts', () => {
    const { low } = cusum([8, 8, 8, 8], 10, 1)
    expect(low).toBeCloseTo(6, 9)
  })

  it('ignores nulls and works with sigma = 0 baselines', () => {
    const { high } = cusum([null, 12, null, 12], 10, 0)
    expect(Number.isFinite(high)).toBe(true)
    expect(high).toBeGreaterThan(0)
  })

  it('resets after the shift disappears', () => {
    const { high } = cusum([12, 12, 7, 7, 7, 7], 10, 1)
    expect(high).toBe(0)
  })
})

describe('movingAverage', () => {
  it('throws for non-positive windows', () => {
    expect(() => movingAverage([1], 0)).toThrow(RangeError)
  })

  it('computes trailing averages', () => {
    expect(movingAverage([1, 2, 3, 4], 2, 1)).toEqual([1, 1.5, 2.5, 3.5])
  })

  it('requires minValid points and never treats nulls as zero', () => {
    const result = movingAverage([null, null, 6], 3, 2)
    expect(result[2]).toBeNull()
    const relaxed = movingAverage([null, null, 6], 3, 1)
    expect(relaxed[2]).toBe(6)
  })

  it('handles empty input', () => {
    expect(movingAverage([], 3)).toEqual([])
  })
})

describe('streaks', () => {
  it('counts trailing rises and falls', () => {
    expect(trailingStreak([1, 2, 3, 4])).toEqual({ up: 3, down: 0 })
    expect(trailingStreak([4, 3, 2, 1])).toEqual({ up: 0, down: 3 })
  })

  it('breaks on ties', () => {
    expect(trailingStreak([1, 2, 2, 3])).toEqual({ up: 1, down: 0 })
  })

  it('skips nulls without breaking the streak', () => {
    expect(trailingStreak([1, null, 2, null, 3])).toEqual({ up: 2, down: 0 })
  })

  it('handles empty, single point and constant series', () => {
    expect(trailingStreak([])).toEqual({ up: 0, down: 0 })
    expect(trailingStreak([5])).toEqual({ up: 0, down: 0 })
    expect(trailingStreak([5, 5, 5])).toEqual({ up: 0, down: 0 })
  })

  it('risingDays / fallingDays count steps in a window', () => {
    expect(risingDays([1, 2, 1, 3, 4])).toBe(3)
    expect(fallingDays([1, 2, 1, 3, 4])).toBe(1)
    expect(risingDays([null, 1, null, 2])).toBe(1)
  })
})

describe('detectCrossover', () => {
  it('reports no cross without data', () => {
    const result = detectCrossover([], 2, 4)
    expect(result.crossedUp).toBe(false)
    expect(result.crossedDown).toBe(false)
    expect(result.gap).toBeNull()
  })

  it('detects a golden cross after a step up', () => {
    const flat = new Array(20).fill(10)
    const rising = [10, 14, 18, 22, 26, 30]
    const result = detectCrossover([...flat, ...rising], 3, 10, 6)
    expect(result.crossedUp).toBe(true)
    expect(result.gap).toBeGreaterThan(0)
  })

  it('detects a death cross after a step down', () => {
    const flat = new Array(20).fill(30)
    const falling = [30, 24, 18, 12, 8, 6]
    const result = detectCrossover([...flat, ...falling], 3, 10, 6)
    expect(result.crossedDown).toBe(true)
  })
})

describe('changepoint (PELT, L2 cost)', () => {
  it('returns empty for short, empty or constant series', () => {
    expect(detectChangepoints([])).toEqual([])
    expect(detectChangepoints([1])).toEqual([])
    expect(detectChangepoints([2, 2, 2, 2, 2, 2, 2, 2])).toEqual([])
  })

  it('finds a clean mean shift at the right location', () => {
    const values = [...new Array(15).fill(10), ...new Array(15).fill(30)]
    const changepoints = detectChangepoints(values)
    expect(changepoints).toEqual([15])
  })

  it('finds two shifts', () => {
    const values = [
      ...new Array(12).fill(5),
      ...new Array(12).fill(25),
      ...new Array(12).fill(5),
    ]
    const changepoints = detectChangepoints(values)
    expect(changepoints).toEqual([12, 24])
  })

  it('is robust to mild noise (no false changepoints)', () => {
    // deterministic pseudo-noise around a constant level
    const values = Array.from({ length: 40 }, (_, i) => 50 + Math.sin(i * 1.7) * 1.5)
    expect(detectChangepoints(values)).toEqual([])
  })

  it('handles negative and extreme values', () => {
    const values = [...new Array(10).fill(-1e6), ...new Array(10).fill(1e6)]
    expect(detectChangepoints(values)).toEqual([10])
  })
})

describe('recentChangepoint', () => {
  it('reports direction and shift for a recent step', () => {
    const values = [...new Array(25).fill(10), ...new Array(5).fill(40)]
    const cp = recentChangepoint(values, 7)
    expect(cp).not.toBeNull()
    expect(cp!.direction).toBe('up')
    expect(cp!.shift).toBeCloseTo(30, 6)
  })

  it('ignores old changepoints', () => {
    const values = [...new Array(10).fill(10), ...new Array(25).fill(40)]
    expect(recentChangepoint(values, 7)).toBeNull()
  })
})

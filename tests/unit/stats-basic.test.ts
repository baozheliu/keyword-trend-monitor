import { describe, expect, it } from 'vitest'
import {
  interquartileRange,
  mean,
  median,
  medianAbsoluteDeviation,
  quantile,
  robustScale,
  slope,
} from '../../src/core/stats/basic'

/**
 * Reference values below reproduce the upstream simple-statistics test
 * expectations (test/median.test.js, test/mad.test.js,
 * test/interquartile_range.test.js, MIT licensed) so that the wrappers are
 * verified against the same inputs/outputs the library itself tests with.
 */
describe('basic statistics (cross-checked against simple-statistics suites)', () => {
  it('median matches upstream expectations', () => {
    // upstream: can get a median of 2 / of an even-length list
    expect(median([1, 2, 3])).toBe(2)
    expect(median([1, 2, 3, 4])).toBe(2.5)
    expect(median([10, 2, 5, 100, 2, 1])).toBe(3.5)
  })

  it('mad matches upstream expectations', () => {
    // upstream mad.test.js: mad([1, 1, 2, 2, 4, 6, 9]) === 1
    expect(medianAbsoluteDeviation([1, 1, 2, 2, 4, 6, 9])).toBe(1)
    // constant list has mad 0
    expect(medianAbsoluteDeviation([1, 1, 1])).toBe(0)
  })

  it('interquartileRange matches upstream expectations', () => {
    // R-7 style quantiles as implemented by simple-statistics
    expect(interquartileRange([1, 2, 3, 4])).toBeCloseTo(1.5, 9)
    expect(interquartileRange([1, 3, 5, 7])).toBeCloseTo(3, 9)
  })

  it('quantile matches upstream expectations', () => {
    // upstream quantile.test.js: quantile of a known sample
    const even = [3, 6, 7, 8, 8, 9, 10, 13, 15, 16, 20]
    expect(quantile(even, 0.5)).toBe(9)
    expect(quantile(even, 0.25)).toBe(7.5)
  })

  it('mean is exact for simple input', () => {
    expect(mean([1, 2, 3])).toBeCloseTo(2, 12)
  })

  it('all wrappers return null for empty arrays instead of throwing', () => {
    expect(mean([])).toBeNull()
    expect(median([])).toBeNull()
    expect(medianAbsoluteDeviation([])).toBeNull()
    expect(interquartileRange([])).toBeNull()
    expect(quantile([], 0.5)).toBeNull()
    expect(robustScale([])).toBeNull()
  })

  it('handles single-point and negative inputs', () => {
    expect(median([-5])).toBe(-5)
    expect(medianAbsoluteDeviation([-5])).toBe(0)
    expect(mean([-1, -3])).toBe(-2)
  })
})

describe('robustScale', () => {
  it('is sigma-consistent for MAD', () => {
    // MAD of [1,1,2,2,4,6,9] is 1 → scale = 1.4826
    expect(robustScale([1, 1, 2, 2, 4, 6, 9])).toBeCloseTo(1.4826, 9)
  })

  it('falls back to IQR when MAD degenerates', () => {
    // more than half identical → MAD = 0, but IQR > 0
    const values = [5, 5, 5, 5, 1, 9, 9]
    expect(medianAbsoluteDeviation(values)).toBe(0)
    expect(interquartileRange(values)).toBeGreaterThan(0)
    const scale = robustScale(values)
    expect(scale).not.toBeNull()
    expect(scale!).toBeGreaterThan(0)
  })

  it('returns 0 for constant series', () => {
    expect(robustScale([3, 3, 3, 3])).toBe(0)
    expect(robustScale([0, 0, 0])).toBe(0)
  })
})

describe('slope', () => {
  it('recovers an exact linear trend', () => {
    expect(slope([1, 2, 3, 4, 5])).toBeCloseTo(1, 12)
    expect(slope([10, 8, 6, 4])).toBeCloseTo(-2, 12)
  })

  it('keeps x positions across gaps (nulls do not compress time)', () => {
    // y = 2x sampled at x = 0 and x = 4 with gaps between
    expect(slope([0, null, null, null, 8])).toBeCloseTo(2, 12)
  })

  it('returns null for <2 valid points, 0 for constants', () => {
    expect(slope([])).toBeNull()
    expect(slope([5])).toBeNull()
    expect(slope([null, null])).toBeNull()
    expect(slope([7, 7, 7])).toBeCloseTo(0, 9)
  })

  it('handles extreme values without overflow', () => {
    const result = slope([1e12, 2e12, 3e12])
    expect(result).toBeCloseTo(1e12, -3)
  })
})

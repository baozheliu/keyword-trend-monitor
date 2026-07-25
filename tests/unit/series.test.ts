import { describe, expect, it } from 'vitest'
import {
  addDays,
  mergeSeries,
  normalizeSeries,
  countValid,
  tail,
  toCalendarValues,
  validValues,
  windowBefore,
} from '../../src/core/series'

describe('normalizeSeries', () => {
  it('returns empty for empty input', () => {
    expect(normalizeSeries([])).toEqual([])
  })

  it('sorts by date ascending', () => {
    const result = normalizeSeries([
      { date: '2026-01-03', value: 3 },
      { date: '2026-01-01', value: 1 },
      { date: '2026-01-02', value: 2 },
    ])
    expect(result.map(p => p.date)).toEqual(['2026-01-01', '2026-01-02', '2026-01-03'])
  })

  it('keeps the newest valid value for duplicate dates', () => {
    const result = normalizeSeries([
      { date: '2026-01-01', value: 10 },
      { date: '2026-01-01', value: 20 },
    ])
    expect(result).toEqual([{ date: '2026-01-01', value: 20 }])
  })

  it('never lets a later null overwrite an earlier valid value', () => {
    const result = normalizeSeries([
      { date: '2026-01-01', value: 10 },
      { date: '2026-01-01', value: null },
    ])
    expect(result).toEqual([{ date: '2026-01-01', value: 10 }])
  })

  it('lets a later valid value replace an earlier null', () => {
    const result = normalizeSeries([
      { date: '2026-01-01', value: null },
      { date: '2026-01-01', value: 7 },
    ])
    expect(result).toEqual([{ date: '2026-01-01', value: 7 }])
  })

  it('normalises NaN/Infinity/non-numbers to null (missing, never zero)', () => {
    const result = normalizeSeries([
      { date: '2026-01-01', value: Number.NaN },
      { date: '2026-01-02', value: Number.POSITIVE_INFINITY },
    ])
    expect(result).toEqual([
      { date: '2026-01-01', value: null },
      { date: '2026-01-02', value: null },
    ])
  })

  it('drops malformed dates', () => {
    const result = normalizeSeries([
      { date: 'not-a-date', value: 1 },
      { date: '2026-13-45', value: 1 },
      { date: '2026-01-01', value: 1 },
    ])
    expect(result).toHaveLength(1)
  })
})

describe('toCalendarValues', () => {
  it('handles empty input', () => {
    expect(toCalendarValues([])).toEqual({ startDate: '', values: [] })
  })

  it('handles a single point', () => {
    expect(toCalendarValues([{ date: '2026-01-01', value: 5 }]))
      .toEqual({ startDate: '2026-01-01', values: [5] })
  })

  it('fills gaps with null, never zero', () => {
    const { values } = toCalendarValues([
      { date: '2026-01-01', value: 1 },
      { date: '2026-01-04', value: 4 },
    ])
    expect(values).toEqual([1, null, null, 4])
  })
})

describe('window helpers', () => {
  const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

  it('tail takes the last N', () => {
    expect(tail(values, 3)).toEqual([8, 9, 10])
    expect(tail(values, 0)).toEqual([])
    expect(tail(values, 100)).toEqual(values)
  })

  it('windowBefore takes N entries before the last offset', () => {
    expect(windowBefore(values, 3, 4)).toEqual([4, 5, 6, 7])
    expect(windowBefore(values, 0, 2)).toEqual([9, 10])
    expect(windowBefore(values, 100, 5)).toEqual([])
  })

  it('countValid / validValues skip nulls', () => {
    expect(countValid([1, null, 2])).toBe(2)
    expect(validValues([null, null])).toEqual([])
  })
})

describe('mergeSeries', () => {
  it('merges, dedups and caps the history length', () => {
    const stored = [{ date: '2026-01-01', value: 1 }, { date: '2026-01-02', value: 2 }]
    const incoming = [{ date: '2026-01-02', value: 20 }, { date: '2026-01-03', value: 3 }]
    const merged = mergeSeries(stored, incoming, 2)
    expect(merged).toEqual([
      { date: '2026-01-02', value: 20 },
      { date: '2026-01-03', value: 3 },
    ])
  })
})

describe('addDays', () => {
  it('crosses month boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })
})

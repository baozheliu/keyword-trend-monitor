import { describe, expect, it } from 'vitest'
import { baiduValuesToPoints, decryptBaiduData } from '../../src/data/baidu'
import { parseTrendsJson, timelineToPoints } from '../../src/data/google'

describe('decryptBaiduData', () => {
  it('maps first-half characters to second-half characters', () => {
    // key: a→1, b→2, c→3, ,→,
    const ptbk = 'abc,123,'
    expect(decryptBaiduData(ptbk, 'ab,cc')).toBe('12,33')
  })

  it('handles empty payloads', () => {
    expect(decryptBaiduData('ab12', '')).toBe('')
  })
})

describe('baiduValuesToPoints', () => {
  it('expands values into consecutive dates', () => {
    const points = baiduValuesToPoints('10,20,30', '2026-01-01', '2026-01-03')
    expect(points).toEqual([
      { date: '2026-01-01', value: 10 },
      { date: '2026-01-02', value: 20 },
      { date: '2026-01-03', value: 30 },
    ])
  })

  it('keeps empty entries as missing (null), never zero', () => {
    const points = baiduValuesToPoints('10,,30', '2026-01-01', '2026-01-03')
    expect(points[1]).toEqual({ date: '2026-01-02', value: null })
  })

  it('never emits dates beyond endDate', () => {
    const points = baiduValuesToPoints('1,2,3,4,5', '2026-01-01', '2026-01-02')
    expect(points).toHaveLength(2)
  })

  it('turns non-numeric junk into missing', () => {
    const points = baiduValuesToPoints('abc', '2026-01-01', '2026-01-01')
    expect(points[0]!.value).toBeNull()
  })
})

describe('parseTrendsJson', () => {
  it('strips the anti-hijacking prefix', () => {
    const parsed = parseTrendsJson(')]}\'\n{"a":1}') as { a: number }
    expect(parsed.a).toBe(1)
  })

  it('throws on non-JSON bodies', () => {
    expect(() => parseTrendsJson('<html>error</html>')).toThrow()
  })
})

describe('timelineToPoints', () => {
  it('converts unix seconds to dates and reads the first value', () => {
    const points = timelineToPoints([
      { time: '1767225600', value: [42], hasData: [true] }, // 2026-01-01 UTC
    ])
    expect(points).toEqual([{ date: '2026-01-01', value: 42 }])
  })

  it('marks hasData=false entries as missing, not zero', () => {
    const points = timelineToPoints([
      { time: '1767225600', value: [0], hasData: [false] },
    ])
    expect(points[0]!.value).toBeNull()
  })

  it('skips partial (incomplete) days and junk times', () => {
    const points = timelineToPoints([
      { time: '1767225600', value: [10], hasData: [true], isPartial: true },
      { time: 'not-a-time', value: [10] },
    ])
    expect(points).toHaveLength(0)
  })
})

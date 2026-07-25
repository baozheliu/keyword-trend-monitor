import { describe, expect, it } from 'vitest'
import { evaluateSeries } from '../../src/core/detect/rules'
import { learningStage } from '../../src/core/detect/features'
import { advanceLifecycle, initialUnitState } from '../../src/core/detect/lifecycle'
import { runSubscription } from '../../src/core/detect/engine'
import type { SeriesPoint, Subscription } from '../../src/core/types'

/** Deterministic pseudo-noise so tests are reproducible. */
function noise(i: number, amplitude: number): number {
  return Math.sin(i * 2.399) * amplitude
}

function flatSeries(days: number, level = 100, amplitude = 3): (number | null)[] {
  return Array.from({ length: days }, (_, i) => level + noise(i, amplitude))
}

describe('learningStage', () => {
  it('maps valid point counts to stages', () => {
    expect(learningStage(0)).toBe('learning')
    expect(learningStage(13)).toBe('learning')
    expect(learningStage(14)).toBe('rapidOnly')
    expect(learningStage(34)).toBe('rapidOnly')
    expect(learningStage(35)).toBe('full')
    expect(learningStage(55)).toBe('full')
    expect(learningStage(56)).toBe('extended')
  })
})

describe('evaluateSeries — learning stages', () => {
  it('never evaluates below 14 valid points', () => {
    const result = evaluateSeries(flatSeries(10), 'smart', 'standard')
    expect(result.stage).toBe('learning')
    expect(result.insufficientData).toBe(true)
    expect(result.triggered).toBe(false)
  })

  it('runs only rapid rules between 14 and 34 points and catches a spike', () => {
    const values = [...flatSeries(20), 300, 320, 340]
    const result = evaluateSeries(values, 'smart', 'standard')
    expect(result.stage).toBe('rapidOnly')
    expect(result.triggered).toBe(true)
    expect(result.direction).toBe('up')
  })

  it('does not run volatility/reversal during the rapid stage', () => {
    const values = [...flatSeries(20), 300, 320, 340]
    expect(evaluateSeries(values, 'volatility', 'standard').insufficientData).toBe(true)
    expect(evaluateSeries(values, 'trendReversal', 'standard').insufficientData).toBe(true)
  })
})

describe('evaluateSeries — data requirements', () => {
  it('refuses to evaluate when the recent 7 days have <5 valid points', () => {
    const values = [...flatSeries(40), null, null, null, 500, 500, null, null]
    const result = evaluateSeries(values, 'smart', 'standard')
    expect(result.insufficientData).toBe(true)
    expect(result.triggered).toBe(false)
  })

  it('refuses when the prior 28 days have <22 valid points', () => {
    const sparse: (number | null)[] = []
    for (let i = 0; i < 60; i += 1) sparse.push(i % 2 === 0 ? 100 : null)
    sparse.push(500, 500, 500, 500, 500, 500, 500)
    const result = evaluateSeries(sparse, 'smart', 'standard')
    expect(result.insufficientData).toBe(true)
  })

  it('missing data never triggers a drop (缺失不视为下降)', () => {
    const values = [...flatSeries(50), null, null, null, null, null, null, null]
    const result = evaluateSeries(values, 'abnormalDrop', 'standard')
    expect(result.triggered).toBe(false)
  })
})

describe('evaluateSeries — templates', () => {
  it('rapidRise fires on a 3-day surge and not on flat data', () => {
    const surge = [...flatSeries(40), 200, 240, 280]
    expect(evaluateSeries(surge, 'rapidRise', 'standard').triggered).toBe(true)
    expect(evaluateSeries(flatSeries(43), 'rapidRise', 'standard').triggered).toBe(false)
  })

  it('abnormalDrop fires on a collapse, not on a rise', () => {
    const collapse = [...flatSeries(40), 30, 25, 20]
    const result = evaluateSeries(collapse, 'abnormalDrop', 'standard')
    expect(result.triggered).toBe(true)
    expect(result.direction).toBe('down')

    const surge = [...flatSeries(40), 300, 320, 340]
    expect(evaluateSeries(surge, 'abnormalDrop', 'standard').triggered).toBe(false)
  })

  it('sustainedRise fires on a steady climb', () => {
    const climb = [...flatSeries(40, 100, 2)]
    for (let i = 1; i <= 7; i += 1) climb.push(100 + i * 12)
    const result = evaluateSeries(climb, 'sustainedRise', 'standard')
    expect(result.triggered).toBe(true)
    expect(result.direction).toBe('up')
  })

  it('sustainedRise stays quiet on flat data', () => {
    expect(evaluateSeries(flatSeries(60), 'sustainedRise', 'standard').triggered).toBe(false)
  })

  it('volatility fires when swings expand dramatically', () => {
    const calm = flatSeries(40, 100, 2)
    const wild = [100, 190, 40, 180, 30, 170, 45]
    const result = evaluateSeries([...calm, ...wild], 'volatility', 'standard')
    expect(result.triggered).toBe(true)
  })

  it('volatility ignores calm data', () => {
    expect(evaluateSeries(flatSeries(60), 'volatility', 'standard').triggered).toBe(false)
  })

  it('trendReversal fires when a decline turns into a climb', () => {
    const values: (number | null)[] = []
    for (let i = 0; i < 30; i += 1) values.push(200 + noise(i, 3)) // stable
    for (let i = 0; i < 14; i += 1) values.push(200 - i * 8 + noise(i, 2)) // decline to ~96
    for (let i = 0; i < 10; i += 1) values.push(96 + i * 14 + noise(i, 2)) // strong recovery
    const result = evaluateSeries(values, 'trendReversal', 'standard')
    expect(result.triggered).toBe(true)
    expect(result.direction).toBe('up')
  })

  it('custom rule respects direction, change and streak', () => {
    const climb = [...flatSeries(40, 100, 0)]
    for (let i = 1; i <= 5; i += 1) climb.push(100 + i * 15)
    const up = evaluateSeries(climb, 'custom', 'standard', {
      direction: 'up',
      windowDays: 7,
      minChangePct: 25,
      minStreakDays: 3,
    })
    expect(up.triggered).toBe(true)

    const down = evaluateSeries(climb, 'custom', 'standard', {
      direction: 'down',
      windowDays: 7,
      minChangePct: 25,
      minStreakDays: 3,
    })
    expect(down.triggered).toBe(false)
  })

  it('smart requires multiple agreeing signal categories', () => {
    const surge = [...flatSeries(50), 220, 260, 300, 340, 380, 420, 460]
    const result = evaluateSeries(surge, 'smart', 'standard')
    expect(result.triggered).toBe(true)
    expect(result.direction).toBe('up')
    expect(result.signals.filter(s => s.direction === 'up' && s.strength >= 1).length)
      .toBeGreaterThanOrEqual(2)
  })

  it('smart stays quiet on flat, periodic and zero data', () => {
    expect(evaluateSeries(flatSeries(80), 'smart', 'standard').triggered).toBe(false)

    const periodic = Array.from({ length: 80 }, (_, i) => 100 + 20 * Math.sin((i * 2 * Math.PI) / 7))
    expect(evaluateSeries(periodic, 'smart', 'standard').triggered).toBe(false)

    const zeros = new Array(80).fill(0)
    expect(evaluateSeries(zeros, 'smart', 'standard').triggered).toBe(false)
  })

  it('low sensitivity requires more than high sensitivity', () => {
    // Moderate rise: ~30% above baseline
    const moderate = [...flatSeries(50, 100, 4), 118, 124, 128, 130, 132, 131, 133]
    const high = evaluateSeries(moderate, 'smart', 'high')
    const low = evaluateSeries(moderate, 'smart', 'low')
    expect(high.score).toBeGreaterThan(low.score)
  })
})

describe('alert lifecycle', () => {
  it('fires once and never re-fires while active', () => {
    let state = initialUnitState()
    let update = advanceLifecycle(state, { triggered: true, score: 1.5 }, '2026-01-01')
    expect(update.fired).toBe(true)
    state = update.state

    update = advanceLifecycle(state, { triggered: true, score: 1.8 }, '2026-01-02')
    expect(update.fired).toBe(false)
    expect(update.state.active).toBe(true)
  })

  it('ignores evaluations for unchanged data dates', () => {
    let state = initialUnitState()
    const first = advanceLifecycle(state, { triggered: true, score: 2 }, '2026-01-01')
    expect(first.fired).toBe(true)
    const repeat = advanceLifecycle(first.state, { triggered: true, score: 2 }, '2026-01-01')
    expect(repeat.fired).toBe(false)
    expect(repeat.state).toBe(first.state)
  })

  it('recovers after 3 consecutive new points below 60% of the threshold', () => {
    let state = advanceLifecycle(initialUnitState(), { triggered: true, score: 1.5 }, '2026-01-01').state

    state = advanceLifecycle(state, { triggered: false, score: 0.5 }, '2026-01-02').state
    expect(state.active).toBe(true)
    state = advanceLifecycle(state, { triggered: false, score: 0.4 }, '2026-01-03').state
    expect(state.active).toBe(true)
    state = advanceLifecycle(state, { triggered: false, score: 0.3 }, '2026-01-04').state
    expect(state.active).toBe(false)

    // After recovery, a new trigger fires again.
    const again = advanceLifecycle(state, { triggered: true, score: 1.2 }, '2026-01-05')
    expect(again.fired).toBe(true)
  })

  it('a score bounce above 60% resets the recovery counter', () => {
    let state = advanceLifecycle(initialUnitState(), { triggered: true, score: 1.5 }, '2026-01-01').state
    state = advanceLifecycle(state, { triggered: false, score: 0.5 }, '2026-01-02').state
    state = advanceLifecycle(state, { triggered: false, score: 0.9 }, '2026-01-03').state
    expect(state.belowCount).toBe(0)
    state = advanceLifecycle(state, { triggered: false, score: 0.5 }, '2026-01-04').state
    state = advanceLifecycle(state, { triggered: false, score: 0.5 }, '2026-01-05').state
    expect(state.active).toBe(true)
  })
})

describe('runSubscription', () => {
  function makeSubscription(overrides: Partial<Subscription> = {}): Subscription {
    return {
      id: 'sub-1',
      name: '测试订阅',
      keywords: ['kw1', 'kw2'],
      sources: {
        baidu: { enabled: true, area: '' },
        google: { enabled: true, area: '' },
      },
      template: 'smart',
      sensitivity: 'standard',
      custom: null,
      icon: { kind: 'letter', value: '测' },
      enabled: true,
      createdAt: 0,
      ...overrides,
    }
  }

  function makePoints(values: (number | null)[]): SeriesPoint[] {
    const points: SeriesPoint[] = []
    const start = Date.parse('2026-01-01T00:00:00Z')
    values.forEach((value, i) => {
      points.push({ date: new Date(start + i * 86_400_000).toISOString().slice(0, 10), value })
    })
    return points
  }

  it('merges triggers from multiple keywords/sources into one run result', () => {
    const surge = makePoints([...flatSeries(50), 300, 340, 380, 420, 460, 500, 540])
    const flat = makePoints(flatSeries(57))

    const result = runSubscription(makeSubscription(), {
      baidu: { kw1: surge, kw2: flat },
      google: { kw1: surge, kw2: surge },
    }, {})

    expect(result.fired.length).toBeGreaterThanOrEqual(2)
    expect(result.direction).toBe('up')
    // Sources stay independent: every contribution names its own source.
    const sources = new Set(result.fired.map(f => f.source))
    expect(sources.has('baidu')).toBe(true)
    expect(sources.has('google')).toBe(true)
  })

  it('does nothing for disabled subscriptions or disabled sources', () => {
    const surge = makePoints([...flatSeries(50), 300, 340, 380, 420, 460, 500, 540])

    const disabled = runSubscription(makeSubscription({ enabled: false }), {
      baidu: { kw1: surge },
    }, {})
    expect(disabled.fired).toHaveLength(0)

    const googleOnly = runSubscription(makeSubscription({
      sources: { baidu: { enabled: false, area: '' }, google: { enabled: true, area: '' } },
    }), { baidu: { kw1: surge } }, {})
    expect(googleOnly.fired).toHaveLength(0)
  })

  it('respects existing active states (no duplicate alerts)', () => {
    const surge = makePoints([...flatSeries(50), 300, 340, 380, 420, 460, 500, 540])
    const sub = makeSubscription({ keywords: ['kw1'] })

    const first = runSubscription(sub, { baidu: { kw1: surge }, google: {} }, {})
    expect(first.fired).toHaveLength(1)

    const second = runSubscription(sub, { baidu: { kw1: surge }, google: {} }, first.states)
    expect(second.fired).toHaveLength(0)
  })
})

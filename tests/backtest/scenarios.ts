/**
 * Synthetic, labelled scenarios for the walk-forward backtest.
 *
 * Every scenario is generated with a seeded RNG so runs are reproducible.
 * Two source profiles are produced: a Baidu-like scale (index ≈ thousands)
 * and a Google-like scale (0..100 integers), which are backtested and
 * reported separately (sources are never merged).
 */
import type { Direction, TemplateId } from '../../src/core/types'

export interface ScenarioEvent {
  /** First day index of the ground-truth event. */
  start: number
  /** Last day index of the event window. */
  end: number
  direction: Direction
  /** Templates whose recall is measured against this event. */
  templates: TemplateId[]
  /** Max new valid data points allowed until detection (latency target). */
  maxLatency?: number
}

export interface Scenario {
  name: string
  kind: string
  values: (number | null)[]
  events: ScenarioEvent[]
}

export type SourceProfile = 'baidu' | 'google'

/** mulberry32 — tiny seeded PRNG (public-domain construction by T. Ettinger). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a += 0x6d2b79f5
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Standard normal via Box–Muller. */
function gaussian(rng: () => number): number {
  const u = Math.max(rng(), 1e-12)
  const v = rng()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

interface ProfileSpec {
  level: number
  /** Relative noise sigma (fraction of level). */
  noise: number
  quantize: (x: number) => number
}

function profileSpec(profile: SourceProfile): ProfileSpec {
  if (profile === 'baidu') {
    return {
      level: 3200,
      noise: 0.05,
      quantize: x => Math.max(0, Math.round(x)),
    }
  }
  return {
    level: 55,
    noise: 0.055,
    quantize: x => Math.max(0, Math.min(100, Math.round(x))),
  }
}

const DAYS = 130
const EVENT_DAY = 85

function baseline(
  spec: ProfileSpec,
  rng: () => number,
  days = DAYS,
  weeklyAmplitude = 0,
): number[] {
  const values: number[] = []
  for (let i = 0; i < days; i += 1) {
    const seasonal = weeklyAmplitude * Math.sin((2 * Math.PI * (i % 7)) / 7)
    const value = spec.level * (1 + seasonal) * (1 + spec.noise * gaussian(rng))
    values.push(spec.quantize(value))
  }
  return values
}

export function makeScenarios(profile: SourceProfile, seed: number): Scenario[] {
  const spec = profileSpec(profile)
  const scenarios: Scenario[] = []
  const rngFor = (offset: number) => mulberry32(seed * 7919 + offset)

  // 1. 平稳趋势 — stationary noise, no events.
  scenarios.push({
    name: `stationary-${profile}-${seed}`,
    kind: 'stationary',
    values: baseline(spec, rngFor(1)),
    events: [],
  })

  // 2. 周期波动 — weekly seasonality, no events.
  scenarios.push({
    name: `periodic-${profile}-${seed}`,
    kind: 'periodic',
    values: baseline(spec, rngFor(2), DAYS, 0.18),
    events: [],
  })

  // 3. 单点尖峰 — 2-day spike (+250%), rapid templates must catch it fast.
  {
    const values = baseline(spec, rngFor(3))
    values[EVENT_DAY] = spec.quantize(spec.level * 3.5)
    values[EVENT_DAY + 1] = spec.quantize(spec.level * 3.0)
    scenarios.push({
      name: `spike-${profile}-${seed}`,
      kind: 'spike',
      values,
      events: [{
        start: EVENT_DAY,
        end: EVENT_DAY + 3,
        direction: 'up',
        templates: ['rapidRise'],
        maxLatency: 2,
      }],
    })
  }

  // 4. 持续上升 — 10-day ramp to +75%.
  {
    const values = baseline(spec, rngFor(4))
    for (let i = 0; i < 10; i += 1) {
      const lift = 1 + 0.75 * ((i + 1) / 10)
      values[EVENT_DAY + i] = spec.quantize(spec.level * lift * (1 + spec.noise * 0.5 * gaussian(rngFor(40 + i))))
    }
    for (let i = EVENT_DAY + 10; i < DAYS; i += 1) {
      values[i] = spec.quantize(spec.level * 1.75 * (1 + spec.noise * gaussian(rngFor(400 + i))))
    }
    scenarios.push({
      name: `ramp-${profile}-${seed}`,
      kind: 'ramp',
      values,
      events: [{
        start: EVENT_DAY,
        end: EVENT_DAY + 16,
        direction: 'up',
        templates: ['smart', 'sustainedRise'],
        // Sustained trends: ~5 points to establish the pattern + 3 to confirm.
        maxLatency: 9,
      }],
    })
  }

  // 5. 阶跃上涨 — immediate +70% level shift.
  {
    const values = baseline(spec, rngFor(5))
    for (let i = EVENT_DAY; i < DAYS; i += 1) {
      values[i] = spec.quantize(spec.level * 1.7 * (1 + spec.noise * gaussian(rngFor(500 + i))))
    }
    scenarios.push({
      name: `step-${profile}-${seed}`,
      kind: 'step',
      values,
      events: [{
        start: EVENT_DAY,
        end: EVENT_DAY + 12,
        direction: 'up',
        templates: ['smart', 'rapidRise'],
        maxLatency: 6,
      }],
    })
  }

  // 6. 趋势反转 — decline (−45%) then strong recovery.
  {
    const values = baseline(spec, rngFor(6))
    const declineStart = EVENT_DAY - 22
    for (let i = 0; i < 14; i += 1) {
      const drop = 1 - 0.45 * ((i + 1) / 14)
      values[declineStart + i] = spec.quantize(spec.level * drop * (1 + spec.noise * 0.5 * gaussian(rngFor(600 + i))))
    }
    const low = spec.level * 0.55
    for (let i = declineStart + 14; i < EVENT_DAY; i += 1) {
      values[i] = spec.quantize(low * (1 + spec.noise * gaussian(rngFor(650 + i))))
    }
    for (let i = 0; EVENT_DAY + i < DAYS; i += 1) {
      const rise = Math.min(1.6, 0.55 + 0.11 * (i + 1))
      values[EVENT_DAY + i] = spec.quantize(spec.level * rise * (1 + spec.noise * 0.5 * gaussian(rngFor(700 + i))))
    }
    scenarios.push({
      name: `reversal-${profile}-${seed}`,
      kind: 'reversal',
      values,
      events: [
        {
          start: EVENT_DAY,
          end: EVENT_DAY + 16,
          direction: 'up',
          templates: ['smart', 'trendReversal'],
          maxLatency: 12,
        },
        // The preceding decline is itself a genuine downward trend; alerts
        // on it are correct detections (recall is not required, though).
        {
          start: declineStart + 3,
          end: EVENT_DAY - 1,
          direction: 'down',
          templates: [],
        },
      ],
    })
  }

  // 7. 异常下降 — collapse to 30% of the level.
  {
    const values = baseline(spec, rngFor(7))
    for (let i = EVENT_DAY; i < DAYS; i += 1) {
      values[i] = spec.quantize(spec.level * 0.3 * (1 + spec.noise * gaussian(rngFor(800 + i))))
    }
    scenarios.push({
      name: `drop-${profile}-${seed}`,
      kind: 'drop',
      values,
      events: [{
        start: EVENT_DAY,
        end: EVENT_DAY + 12,
        direction: 'down',
        templates: ['smart', 'abnormalDrop'],
        maxLatency: 6,
      }],
    })
  }

  // 8. 剧烈波动 — swings expand to ±60% for ten days.
  {
    const values = baseline(spec, rngFor(8))
    for (let i = 0; i < 10; i += 1) {
      const swing = (i % 2 === 0 ? 1 : -1) * 0.6
      values[EVENT_DAY + i] = spec.quantize(spec.level * (1 + swing) * (1 + spec.noise * gaussian(rngFor(900 + i))))
    }
    scenarios.push({
      name: `volatility-${profile}-${seed}`,
      kind: 'volatility',
      values,
      events: [
        {
          start: EVENT_DAY,
          end: EVENT_DAY + 12,
          direction: 'up',
          templates: ['volatility'],
          maxLatency: 8,
        },
        // Swings of ±60% are real moves in both directions; directional
        // detectors may legitimately fire downwards inside the burst.
        {
          start: EVENT_DAY,
          end: EVENT_DAY + 12,
          direction: 'down',
          templates: [],
        },
      ],
    })
  }

  // 9. 缺失数据 — random gaps plus a 6-day outage; must never alert.
  {
    const values: (number | null)[] = baseline(spec, rngFor(9))
    const rng = rngFor(99)
    for (let i = 20; i < DAYS; i += 1) {
      if (rng() < 0.08) values[i] = null
    }
    for (let i = EVENT_DAY; i < EVENT_DAY + 6; i += 1) values[i] = null
    scenarios.push({
      name: `missing-${profile}-${seed}`,
      kind: 'missing',
      values,
      events: [],
    })
  }

  // 10. 零值 — a keyword nobody searches for; constant zero, no alerts.
  scenarios.push({
    name: `zeros-${profile}-${seed}`,
    kind: 'zeros',
    values: new Array<number | null>(DAYS).fill(0),
    events: [],
  })

  // 11. 长期不更新 — the feed freezes after day 90; no alerts afterwards.
  {
    const values: (number | null)[] = baseline(spec, rngFor(11))
    for (let i = 90; i < DAYS; i += 1) values[i] = null
    scenarios.push({
      name: `stale-${profile}-${seed}`,
      kind: 'stale',
      values,
      events: [],
    })
  }

  return scenarios
}

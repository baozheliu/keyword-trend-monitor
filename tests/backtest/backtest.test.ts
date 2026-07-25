import { beforeAll, describe, expect, it } from 'vitest'
import { emptyMetrics, scoreScenario, summarize, walkForward, type BacktestMetrics } from './harness'
import { makeScenarios, type Scenario, type SourceProfile } from './scenarios'
import type { Sensitivity, TemplateId } from '../../src/core/types'

const SEEDS = [1, 2, 3, 4, 5]
const PROFILES: SourceProfile[] = ['baidu', 'google']
const SENSITIVITIES: Sensitivity[] = ['high', 'standard', 'low']

/** Backtest targets from the product spec. */
const TARGETS: Record<Sensitivity, { precision: number, recall: number, fpPerMonth: number }> = {
  high: { precision: 0.70, recall: 0.85, fpPerMonth: 2 },
  standard: { precision: 0.85, recall: 0.75, fpPerMonth: 1 },
  low: { precision: 0.92, recall: 0.60, fpPerMonth: 0.5 },
}

const scenarioCache = new Map<string, Scenario[]>()
function scenariosFor(profile: SourceProfile): Scenario[] {
  const cached = scenarioCache.get(profile)
  if (cached) return cached
  const scenarios = SEEDS.flatMap(seed => makeScenarios(profile, seed))
  scenarioCache.set(profile, scenarios)
  return scenarios
}

function runBacktest(
  profile: SourceProfile,
  template: TemplateId,
  sensitivity: Sensitivity,
  kinds?: string[],
): BacktestMetrics {
  const metrics = emptyMetrics()
  for (const scenario of scenariosFor(profile)) {
    if (kinds && !kinds.includes(scenario.kind)) continue
    const alerts = walkForward(scenario, template, sensitivity)
    scoreScenario(scenario, template, alerts, metrics)
  }
  return metrics
}

describe('智能监测 walk-forward backtest (per source, per sensitivity)', () => {
  const rows: string[] = []

  beforeAll(() => {
    rows.push('profile | sensitivity | precision | recall | FP/kw-month | dup | missFP')
  })

  for (const profile of PROFILES) {
    for (const sensitivity of SENSITIVITIES) {
      it(`${profile} / ${sensitivity} meets precision, recall and FP targets`, () => {
        const metrics = runBacktest(profile, 'smart', sensitivity)
        const summary = summarize(metrics)
        const target = TARGETS[sensitivity]

        const line = `${profile} | ${sensitivity} | ${summary.precision.toFixed(3)} | ${summary.recall.toFixed(3)}`
          + ` | ${summary.falsePositivesPerKeywordMonth.toFixed(3)} | ${metrics.duplicateAlerts} | ${metrics.missingDataFalsePositives}`
        rows.push(line)
        console.log(`[backtest] smart ${line}`)

        expect(summary.precision, 'precision').toBeGreaterThanOrEqual(target.precision)
        expect(summary.recall, 'recall').toBeGreaterThanOrEqual(target.recall)
        expect(summary.falsePositivesPerKeywordMonth, 'FP/month').toBeLessThanOrEqual(target.fpPerMonth)
        // Same trend event alerts exactly once.
        expect(metrics.duplicateAlerts, 'duplicate alerts').toBe(0)
        // Missing data must cause zero false alerts.
        expect(metrics.missingDataFalsePositives, 'missing-data FP').toBe(0)
      })
    }
  }
})

describe('template-specific backtests (standard sensitivity)', () => {
  for (const profile of PROFILES) {
    it(`${profile}: 快速升温 detects spikes/steps within 2 new points`, () => {
      const metrics = runBacktest(profile, 'rapidRise', 'standard', ['spike', 'step', 'stationary', 'periodic', 'missing', 'stale', 'zeros'])
      const summary = summarize(metrics)
      console.log(`[backtest] rapidRise ${profile} P=${summary.precision.toFixed(3)} R=${summary.recall.toFixed(3)} lat-miss=${metrics.latencyMisses}`)
      expect(summary.recall).toBe(1)
      expect(metrics.latencyMisses).toBe(0)
      expect(metrics.missingDataFalsePositives).toBe(0)
      expect(metrics.duplicateAlerts).toBe(0)
    })

    it(`${profile}: 持续上升 detects ramps within 3 points of establishment`, () => {
      const metrics = runBacktest(profile, 'sustainedRise', 'standard', ['ramp', 'stationary', 'periodic', 'missing', 'zeros'])
      const summary = summarize(metrics)
      console.log(`[backtest] sustainedRise ${profile} P=${summary.precision.toFixed(3)} R=${summary.recall.toFixed(3)} lat-miss=${metrics.latencyMisses}`)
      expect(summary.recall).toBe(1)
      expect(metrics.latencyMisses).toBe(0)
      expect(metrics.missingDataFalsePositives).toBe(0)
    })

    it(`${profile}: 趋势反转 detects reversals`, () => {
      const metrics = runBacktest(profile, 'trendReversal', 'standard', ['reversal', 'stationary', 'periodic', 'missing'])
      const summary = summarize(metrics)
      console.log(`[backtest] trendReversal ${profile} P=${summary.precision.toFixed(3)} R=${summary.recall.toFixed(3)}`)
      expect(summary.recall).toBeGreaterThanOrEqual(0.8)
      expect(metrics.missingDataFalsePositives).toBe(0)
    })

    it(`${profile}: 异常下降 detects collapses and never fires on missing data`, () => {
      const metrics = runBacktest(profile, 'abnormalDrop', 'standard', ['drop', 'missing', 'stale', 'zeros', 'stationary'])
      const summary = summarize(metrics)
      console.log(`[backtest] abnormalDrop ${profile} P=${summary.precision.toFixed(3)} R=${summary.recall.toFixed(3)}`)
      expect(summary.recall).toBe(1)
      expect(metrics.missingDataFalsePositives).toBe(0)
      expect(metrics.duplicateAlerts).toBe(0)
    })

    it(`${profile}: 剧烈波动 detects volatility bursts`, () => {
      const metrics = runBacktest(profile, 'volatility', 'standard', ['volatility', 'stationary', 'periodic', 'zeros'])
      const summary = summarize(metrics)
      console.log(`[backtest] volatility ${profile} P=${summary.precision.toFixed(3)} R=${summary.recall.toFixed(3)}`)
      expect(summary.recall).toBeGreaterThanOrEqual(0.8)
      expect(metrics.missingDataFalsePositives).toBe(0)
    })
  }
})

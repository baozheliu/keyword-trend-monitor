/**
 * Walk-forward backtest harness.
 *
 * Time advances strictly forwards: at day t the detector only sees
 * values[0..t]. There is no shuffling and no future leakage. The alert
 * lifecycle (dedup + recovery) is threaded through the walk exactly as in
 * production.
 */
import { evaluateSeries } from '../../src/core/detect/rules'
import { advanceLifecycle, initialUnitState } from '../../src/core/detect/lifecycle'
import type { Direction, Sensitivity, TemplateId, UnitAlertState } from '../../src/core/types'
import type { Scenario, ScenarioEvent } from './scenarios'

export interface FiredAlert {
  day: number
  direction: Direction
}

/** Replay one scenario against one template; returns fired alerts in order. */
export function walkForward(
  scenario: Scenario,
  template: TemplateId,
  sensitivity: Sensitivity,
): FiredAlert[] {
  const alerts: FiredAlert[] = []
  const states: Record<Direction, UnitAlertState> = {
    up: initialUnitState(),
    down: initialUnitState(),
  }

  for (let t = 0; t < scenario.values.length; t += 1) {
    // A day without data does not advance the data date → nothing to do
    // (mirrors "数据未更新时不重复计算或告警").
    if (scenario.values[t] === null) continue

    const slice = scenario.values.slice(0, t + 1)
    const result = evaluateSeries(slice, template, sensitivity)
    const dataDate = String(100000 + t) // ordered pseudo-date

    for (const direction of ['up', 'down'] as const) {
      const directional = result.direction === direction
        ? result
        : { triggered: false, score: 0 }
      const { state, fired } = advanceLifecycle(states[direction], directional, dataDate)
      states[direction] = state
      if (fired) alerts.push({ day: t, direction })
    }
  }

  return alerts
}

export interface BacktestMetrics {
  truePositives: number
  falsePositives: number
  eventsTotal: number
  eventsDetected: number
  /** Events that missed their latency target. */
  latencyMisses: number
  /** Events that produced more than one alert. */
  duplicateAlerts: number
  /** False positives raised in missing-data scenarios (must be 0). */
  missingDataFalsePositives: number
  evaluatedDays: number
}

export function emptyMetrics(): BacktestMetrics {
  return {
    truePositives: 0,
    falsePositives: 0,
    eventsTotal: 0,
    eventsDetected: 0,
    latencyMisses: 0,
    duplicateAlerts: 0,
    missingDataFalsePositives: 0,
    evaluatedDays: 0,
  }
}

function validPointsBetween(values: readonly (number | null)[], from: number, to: number): number {
  let count = 0
  for (let i = from; i <= to && i < values.length; i += 1) {
    if (values[i] !== null) count += 1
  }
  return count
}

const EVENT_TOLERANCE_DAYS = 6

function matchEvent(events: readonly ScenarioEvent[], alert: FiredAlert): ScenarioEvent | null {
  for (const event of events) {
    if (alert.direction !== event.direction) continue
    if (alert.day >= event.start && alert.day <= event.end + EVENT_TOLERANCE_DAYS) return event
  }
  return null
}

/**
 * Score a scenario replay. Recall/latency are only accounted for events
 * that list `template` in their `templates`; precision counts an alert as
 * TP when it falls inside any event window of the right direction.
 */
export function scoreScenario(
  scenario: Scenario,
  template: TemplateId,
  alerts: readonly FiredAlert[],
  metrics: BacktestMetrics,
): void {
  metrics.evaluatedDays += scenario.values.filter(v => v !== null).length

  const alertsPerEvent = new Map<ScenarioEvent, number>()

  for (const alert of alerts) {
    const event = matchEvent(scenario.events, alert)
    if (event) {
      metrics.truePositives += 1
      alertsPerEvent.set(event, (alertsPerEvent.get(event) ?? 0) + 1)
    } else {
      metrics.falsePositives += 1
      if (scenario.kind === 'missing' || scenario.kind === 'stale') {
        metrics.missingDataFalsePositives += 1
      }
    }
  }

  for (const event of scenario.events) {
    if (!event.templates.includes(template)) continue
    metrics.eventsTotal += 1

    const count = alertsPerEvent.get(event) ?? 0
    if (count > 1) metrics.duplicateAlerts += 1
    if (count === 0) continue

    metrics.eventsDetected += 1

    if (event.maxLatency !== undefined) {
      const firstAlert = alerts.find(a => matchEvent([event], a) === event)!
      const latency = validPointsBetween(scenario.values, event.start, firstAlert.day)
      if (latency > event.maxLatency) metrics.latencyMisses += 1
    }
  }
}

export interface MetricsSummary {
  precision: number
  recall: number
  falsePositivesPerKeywordMonth: number
}

export function summarize(metrics: BacktestMetrics): MetricsSummary {
  const alerts = metrics.truePositives + metrics.falsePositives
  const months = metrics.evaluatedDays / 30
  return {
    precision: alerts === 0 ? 1 : metrics.truePositives / alerts,
    recall: metrics.eventsTotal === 0 ? 1 : metrics.eventsDetected / metrics.eventsTotal,
    falsePositivesPerKeywordMonth: months === 0 ? 0 : metrics.falsePositives / months,
  }
}

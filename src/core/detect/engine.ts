/**
 * Subscription-level evaluation.
 *
 * Every keyword × enabled source is evaluated independently; the sources are
 * never merged, averaged or compared. All triggers produced by one run are
 * combined into a single alert per subscription (同一订阅合并为一条告警).
 */
import { evaluateSeries } from './rules'
import { advanceLifecycle, initialUnitState, unitKey } from './lifecycle'
import { toCalendarValues } from '../series'
import type {
  AlertContribution,
  Direction,
  RuleEvaluation,
  SeriesPoint,
  SourceId,
  Subscription,
  UnitAlertState,
} from '../types'

export type SeriesBundle = Partial<Record<SourceId, Record<string, SeriesPoint[]>>>

export interface UnitEvaluation {
  source: SourceId
  keyword: string
  evaluation: RuleEvaluation
  dataDate: string
}

export interface SubscriptionRunResult {
  /** Contributions of units that newly fired in this run. */
  fired: AlertContribution[]
  /** Direction of the merged alert (dominant among fired units). */
  direction: Direction | null
  /** Updated lifecycle states (only touched keys included). */
  states: Record<string, UnitAlertState>
  /** All unit evaluations, for UI/status purposes. */
  evaluations: UnitEvaluation[]
}

export const SOURCE_IDS: readonly SourceId[] = ['baidu', 'google'] as const

export function runSubscription(
  subscription: Subscription,
  series: SeriesBundle,
  previousStates: Readonly<Record<string, UnitAlertState>>,
): SubscriptionRunResult {
  const fired: AlertContribution[] = []
  const states: Record<string, UnitAlertState> = {}
  const evaluations: UnitEvaluation[] = []

  if (!subscription.enabled) {
    return { fired, direction: null, states, evaluations }
  }

  for (const source of SOURCE_IDS) {
    if (!subscription.sources[source]?.enabled) continue

    for (const keyword of subscription.keywords) {
      const points = series[source]?.[keyword]
      if (!points || points.length === 0) continue

      const { values } = toCalendarValues(points)
      const lastPoint = points[points.length - 1]
      const dataDate = lastPoint?.date ?? ''

      const result = evaluateSeries(
        values,
        subscription.template,
        subscription.sensitivity,
        subscription.custom,
      )
      evaluations.push({ source, keyword, evaluation: result, dataDate })

      // Fetch failures and missing data can never trigger any direction:
      // evaluateSeries already refuses to trigger on insufficient data.
      const directions: Direction[] = ['up', 'down']
      for (const direction of directions) {
        const key = unitKey(subscription.id, source, keyword, direction)
        const previous = previousStates[key] ?? initialUnitState()
        const directional = result.direction === direction
          ? result
          : { triggered: false, score: 0 }

        const { state, fired: unitFired } = advanceLifecycle(previous, directional, dataDate)
        states[key] = state

        if (unitFired) {
          fired.push({
            source,
            keyword,
            direction,
            score: result.score,
            dataDate,
          })
        }
      }
    }
  }

  let direction: Direction | null = null
  if (fired.length > 0) {
    const ups = fired.filter(item => item.direction === 'up').length
    direction = ups * 2 >= fired.length ? 'up' : 'down'
  }

  return { fired, direction, states, evaluations }
}

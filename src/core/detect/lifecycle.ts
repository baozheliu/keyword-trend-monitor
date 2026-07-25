/**
 * Alert lifecycle: deduplication, recovery and direction reversal.
 *
 * - While an alert is active the same unit never re-fires.
 * - The unit recovers after 3 consecutive *new data points* whose score is
 *   below 60% of the trigger threshold; only then can a new alert fire.
 * - Direction is part of the unit key, so a reversal (up → down) is a new
 *   alert by construction.
 * - Evaluations for unchanged data dates are ignored entirely
 *   (数据未更新时不重复计算或告警).
 */
import { LIFECYCLE } from '../constants'
import type { Direction, RuleEvaluation, UnitAlertState } from '../types'

export interface LifecycleUpdate {
  state: UnitAlertState
  /** True exactly when a new alert must be emitted for this unit. */
  fired: boolean
}

export function initialUnitState(): UnitAlertState {
  return { active: false, belowCount: 0, lastDataDate: '', lastScore: 0 }
}

export function unitKey(
  subscriptionId: string,
  source: string,
  keyword: string,
  direction: Direction,
): string {
  return `${subscriptionId}\u0000${source}\u0000${keyword}\u0000${direction}`
}

/**
 * Advance the lifecycle with a fresh evaluation.
 *
 * @param state     previous state (or `initialUnitState()`)
 * @param result    evaluation of the series as of `dataDate`
 * @param dataDate  date (YYYY-MM-DD) of the newest point in the series
 */
export function advanceLifecycle(
  state: UnitAlertState,
  result: Pick<RuleEvaluation, 'triggered' | 'score'>,
  dataDate: string,
): LifecycleUpdate {
  // No new data → nothing changes, never re-alert.
  if (!dataDate || dataDate <= state.lastDataDate) {
    return { state, fired: false }
  }

  const next: UnitAlertState = {
    ...state,
    lastDataDate: dataDate,
    lastScore: result.score,
  }

  if (!state.active) {
    if (result.triggered) {
      next.active = true
      next.belowCount = 0
      return { state: next, fired: true }
    }
    next.belowCount = 0
    return { state: next, fired: false }
  }

  // Active: check recovery, never re-fire.
  if (result.score < LIFECYCLE.recoveryFraction) {
    next.belowCount = state.belowCount + 1
    if (next.belowCount >= LIFECYCLE.recoveryPoints) {
      next.active = false
      next.belowCount = 0
    }
  } else {
    next.belowCount = 0
  }

  return { state: next, fired: false }
}

/**
 * Feature extraction shared by all alert templates.
 * Every feature is computed on a calendar-aligned value array
 * (`null` = missing day) for a single keyword × source series.
 */
import { LEARNING_STAGES, DATA_REQUIREMENTS, WINDOWS } from '../constants'
import { countValid, tail, validValues, windowBefore } from '../series'
import { median, robustScale, slope } from '../stats/basic'
import { detectCrossover } from '../stats/crossover'
import { cusum } from '../stats/cusum'
import { ewmaChart } from '../stats/ewma'
import { recentChangepoint } from '../stats/changepoint'
import { robustScore } from '../stats/robust'
import { fallingDays, risingDays, trailingStreak } from '../stats/streaks'
import type { LearningStage } from '../types'

export interface SeriesFeatures {
  stage: LearningStage
  totalValid: number

  /** Recent/baseline windows (calendar aligned). */
  recent7: (number | null)[]
  recent3: (number | null)[]
  baseline28: (number | null)[]

  recent7Valid: number
  recent3Valid: number
  baseline28Valid: number

  /** Robust level estimates. */
  recentLevel7: number | null
  recentLevel3: number | null
  baselineLevel: number | null
  baselineScale: number | null

  /** Relative change of recent level vs baseline level (fraction). */
  changePct7: number | null
  changePct3: number | null
  /** Recent 7-day level vs the immediately preceding 7-day level. */
  weekOverWeekPct: number | null

  /** Robust anomaly scores of recent levels against the baseline sample. */
  robustScore7: number | null
  robustScore3: number | null

  /** Momentum. */
  ewmaZ: number | null
  cusumHigh: number
  cusumLow: number

  /** Trend. */
  slope7: number | null
  slopePrev7: number | null
  /** Minimum slope across lagged previous windows (reversal precondition). */
  slopePrevMin: number | null
  /** slope7 expressed as total relative change across the 7-day window. */
  slopeChangePct: number | null

  risingDays7: number
  fallingDays7: number
  streakUp: number
  streakDown: number

  crossedUp: boolean
  crossedDown: boolean
  crossoverGap: number | null

  /** Volatility. */
  volatilityRatio: number | null
  rangePct7: number | null

  /** Changepoint (only computed at the extended stage). */
  changepoint: { direction: 'up' | 'down', shiftPct: number } | null

  /** Whether the 7/28 data sufficiency requirements are satisfied. */
  meetsFullDataRequirements: boolean
  /** Whether the reduced rapid-stage requirements are satisfied. */
  meetsRapidDataRequirements: boolean
}

export function learningStage(totalValid: number): LearningStage {
  if (totalValid < LEARNING_STAGES.chartOnly) return 'learning'
  if (totalValid < LEARNING_STAGES.rapidOnly) return 'rapidOnly'
  if (totalValid < LEARNING_STAGES.extended) return 'full'
  return 'extended'
}

/** Denominator floor to keep relative changes finite on tiny baselines. */
function levelFloor(baselineLevel: number | null, baselineScale: number | null): number {
  const level = Math.abs(baselineLevel ?? 0)
  const scale = baselineScale ?? 0
  return Math.max(level, scale, 1e-9)
}

function relativeChange(recent: number | null, base: number | null, scale: number | null): number | null {
  if (recent === null || base === null) return null
  return (recent - base) / levelFloor(base, scale)
}

export function extractFeatures(values: readonly (number | null)[]): SeriesFeatures {
  const totalValid = countValid(values)
  const stage = learningStage(totalValid)

  const recent7 = tail(values, WINDOWS.recent)
  const recent3 = tail(values, WINDOWS.recentShort)
  const baseline28 = windowBefore(values, WINDOWS.recent, WINDOWS.baseline)
  // Baseline for the 3-day window excludes only the last 3 days.
  const baseline28For3 = windowBefore(values, WINDOWS.recentShort, WINDOWS.baseline)

  const recent7Valid = countValid(recent7)
  const recent3Valid = countValid(recent3)
  const baseline28Valid = countValid(baseline28)
  const baseline28For3Valid = countValid(baseline28For3)

  const baselineValues = validValues(baseline28)
  const baselineFor3Values = validValues(baseline28For3)

  const recentLevel7 = median(validValues(recent7))
  const recentLevel3 = median(validValues(recent3))
  const baselineLevel = median(baselineValues)
  const baselineScale = robustScale(baselineValues)
  const baselineFor3Level = median(baselineFor3Values)
  const baselineFor3Scale = robustScale(baselineFor3Values)

  const changePct7 = relativeChange(recentLevel7, baselineLevel, baselineScale)
  const changePct3 = relativeChange(recentLevel3, baselineFor3Level, baselineFor3Scale)

  const priorWeekLevel = median(validValues(windowBefore(values, WINDOWS.recent, WINDOWS.recent)))
  const weekOverWeekPct = recentLevel7 === null || priorWeekLevel === null
    ? null
    : (recentLevel7 - priorWeekLevel) / levelFloor(baselineLevel ?? priorWeekLevel, baselineScale)

  const robustScore7 = recentLevel7 === null ? null : robustScore(recentLevel7, baselineValues)
  const robustScore3 = recentLevel3 === null ? null : robustScore(recentLevel3, baselineFor3Values)

  const ewma = baselineLevel === null || baselineScale === null
    ? null
    : ewmaChart(recent7, baselineLevel, baselineScale)
  const cusumResult = baselineLevel === null
    ? { high: 0, low: 0 }
    : cusum(recent7, baselineLevel, baselineScale ?? 0)

  const slope7 = slope(recent7)
  const slopePrev7 = slope(windowBefore(values, WINDOWS.recent, WINDOWS.recent))
  // "The previous trend was not positive" is checked over a few lagged
  // windows, because the MA7×MA28 cross confirms a few days after the turn.
  let slopePrevMin: number | null = slopePrev7
  for (const offset of [9, 11, 13]) {
    const lagged = slope(windowBefore(values, offset, WINDOWS.recent))
    if (lagged !== null && (slopePrevMin === null || lagged < slopePrevMin)) {
      slopePrevMin = lagged
    }
  }
  const slopeChangePct = slope7 === null
    ? null
    : (slope7 * (WINDOWS.recent - 1)) / levelFloor(baselineLevel, baselineScale)

  const streaks = trailingStreak(values)
  const crossover = detectCrossover(values, WINDOWS.recent, WINDOWS.baseline, 5)

  const recentScale = robustScale(validValues(recent7))
  let volatilityRatio: number | null = null
  if (recentScale !== null && baselineScale !== null) {
    // The 5% floor keeps quantised low-scale series (e.g. Google's 0..100
    // integers) from producing huge ratios out of rounding noise.
    const floor = Math.max(baselineScale, levelFloor(baselineLevel, baselineScale) * 0.05)
    volatilityRatio = recentScale / floor
  }

  const recentValid = validValues(recent7)
  let rangePct7: number | null = null
  if (recentValid.length >= 2) {
    const range = Math.max(...recentValid) - Math.min(...recentValid)
    rangePct7 = range / levelFloor(baselineLevel, baselineScale)
  }

  let changepoint: SeriesFeatures['changepoint'] = null
  if (stage === 'extended') {
    const allValid = validValues(values)
    const cp = recentChangepoint(allValid, WINDOWS.recent, { minSegment: 3 })
    if (cp) {
      changepoint = {
        direction: cp.direction,
        shiftPct: cp.shift / levelFloor(baselineLevel, baselineScale),
      }
    }
  }

  const meetsFullDataRequirements = recent7Valid >= DATA_REQUIREMENTS.minValidRecent7
    && baseline28Valid >= DATA_REQUIREMENTS.minValidBaseline28
  const meetsRapidDataRequirements = recent3Valid >= 2 && baseline28For3Valid >= 10

  return {
    stage,
    totalValid,
    recent7,
    recent3,
    baseline28,
    recent7Valid,
    recent3Valid,
    baseline28Valid,
    recentLevel7,
    recentLevel3,
    baselineLevel,
    baselineScale,
    changePct7,
    changePct3,
    weekOverWeekPct,
    robustScore7,
    robustScore3,
    ewmaZ: ewma?.z ?? null,
    cusumHigh: cusumResult.high,
    cusumLow: cusumResult.low,
    slope7,
    slopePrev7,
    slopePrevMin,
    slopeChangePct,
    risingDays7: risingDays(recent7),
    fallingDays7: fallingDays(recent7),
    streakUp: streaks.up,
    streakDown: streaks.down,
    crossedUp: crossover.crossedUp,
    crossedDown: crossover.crossedDown,
    crossoverGap: crossover.gap,
    volatilityRatio,
    rangePct7,
    changepoint,
    meetsFullDataRequirements,
    meetsRapidDataRequirements,
  }
}

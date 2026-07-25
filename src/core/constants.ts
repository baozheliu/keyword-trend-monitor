import type { Sensitivity, TemplateId } from './types'

/** Product limits (fixed, see product spec). */
export const LIMITS = Object.freeze({
  maxSubscriptions: 5,
  maxKeywordsPerSubscription: 5,
  /** Hourly checks, at most 24 per day. */
  checkIntervalMinutes: 60,
  maxChecksPerDay: 24,
  /** Days of history kept per keyword × source. */
  maxHistoryDays: 400,
})

/** Windows used by the 7/28 algorithm cluster. */
export const WINDOWS = Object.freeze({
  recentShort: 3,
  recent: 7,
  baseline: 28,
})

/** Data sufficiency requirements. */
export const DATA_REQUIREMENTS = Object.freeze({
  /** Recent 7 days must contain at least this many valid points. */
  minValidRecent7: 5,
  /** Prior 28 days must contain at least this many valid points. */
  minValidBaseline28: 22,
})

/** Learning stage boundaries (valid point counts). */
export const LEARNING_STAGES = Object.freeze({
  chartOnly: 14, // below: charts only
  rapidOnly: 35, // 14..34: rapid-change rules only
  extended: 56, // >=56: seasonal baseline + changepoint detection
})

export interface SensitivityParams {
  /** Minimum relative change vs baseline (fraction, e.g. 0.25 = 25%). */
  minChange: number
  /** Robust (median/MAD) anomaly score threshold. */
  madZ: number
  /** Distinct signal categories that must agree for 智能监测. */
  minSignals: number
  /** Minimum rising days (of last 7) for 持续上升. */
  minRisingDays: number
  /** MAD ratio threshold for 剧烈波动. */
  volatilityRatio: number
}

export const SENSITIVITY_PARAMS: Readonly<Record<Sensitivity, SensitivityParams>> = Object.freeze({
  high: { minChange: 0.15, madZ: 2.5, minSignals: 2, minRisingDays: 4, volatilityRatio: 1.8 },
  standard: { minChange: 0.25, madZ: 3.5, minSignals: 2, minRisingDays: 5, volatilityRatio: 2.5 },
  low: { minChange: 0.40, madZ: 4.5, minSignals: 3, minRisingDays: 6, volatilityRatio: 3.5 },
})

/** Alert lifecycle: recover after N new points below `recoveryFraction` of threshold. */
export const LIFECYCLE = Object.freeze({
  recoveryFraction: 0.6,
  recoveryPoints: 3,
})

export const TEMPLATE_IDS: readonly TemplateId[] = Object.freeze([
  'smart',
  'rapidRise',
  'sustainedRise',
  'trendReversal',
  'abnormalDrop',
  'volatility',
  'custom',
])

export const DEFAULT_TEMPLATE: TemplateId = 'smart'
export const DEFAULT_SENSITIVITY: Sensitivity = 'standard'

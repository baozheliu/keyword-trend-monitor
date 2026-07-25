/**
 * Core domain types for Keyword Watch.
 * All analytics run locally; these types are shared by the background
 * service worker, the popup/options UIs and the test suites.
 */

export type SourceId = 'baidu' | 'google'

/** A single daily observation. `value === null` means "missing", never zero. */
export interface SeriesPoint {
  /** Calendar day in `YYYY-MM-DD` (source-local). */
  date: string
  /** Raw index value, or null when the source had no valid data for the day. */
  value: number | null
}

export type TemplateId =
  | 'smart'
  | 'rapidRise'
  | 'sustainedRise'
  | 'trendReversal'
  | 'abnormalDrop'
  | 'volatility'
  | 'custom'

export type Sensitivity = 'high' | 'standard' | 'low'

export type Direction = 'up' | 'down'

export interface CustomRuleConfig {
  direction: Direction
  /** Recent evaluation window in days (周期). */
  windowDays: number
  /** Minimum relative change vs baseline, in percent (幅度). */
  minChangePct: number
  /** Minimum consecutive rising/falling days (连续天数). */
  minStreakDays: number
}

export interface SubscriptionSourceConfig {
  enabled: boolean
  /**
   * Region code. Empty string = source default
   * (Baidu: 全国, Google: 全球).
   */
  area: string
}

export interface SubscriptionIcon {
  kind: 'letter' | 'emoji' | 'image'
  /** letter: single display character; emoji: emoji char; image: storage key. */
  value: string
}

export interface Subscription {
  id: string
  name: string
  keywords: string[]
  sources: Record<SourceId, SubscriptionSourceConfig>
  template: TemplateId
  sensitivity: Sensitivity
  custom: CustomRuleConfig | null
  icon: SubscriptionIcon
  enabled: boolean
  createdAt: number
}

/** Learning stage derived from the number of valid points in a series. */
export type LearningStage = 'learning' | 'rapidOnly' | 'full' | 'extended'

/** Signal categories used by the voting logic of 智能监测. */
export type SignalCategory =
  | 'change'
  | 'robust'
  | 'momentum'
  | 'trend'
  | 'crossover'
  | 'changepoint'

export interface Signal {
  category: SignalCategory
  direction: Direction
  /** Ratio of observed magnitude to its trigger threshold; >= 1 means firing. */
  strength: number
  detail: string
}

export interface RuleEvaluation {
  triggered: boolean
  direction: Direction | null
  /**
   * Trend score normalised so that 1.0 equals the trigger threshold.
   * Used by the alert lifecycle (recovery below 0.6 for 3 new points).
   */
  score: number
  signals: Signal[]
  stage: LearningStage
  /** True when the series did not satisfy the data requirements. */
  insufficientData: boolean
}

/** Per (subscription × source × keyword × direction) alert lifecycle state. */
export interface UnitAlertState {
  active: boolean
  /** Consecutive new data points with score below 60% of the threshold. */
  belowCount: number
  /** Last data date processed, so unchanged data never re-triggers. */
  lastDataDate: string
  lastScore: number
}

export interface AlertContribution {
  source: SourceId
  keyword: string
  direction: Direction
  score: number
  /** Data date that produced the trigger (marks the dot on the chart). */
  dataDate: string
}

export interface AlertRecord {
  id: string
  subscriptionId: string
  message: string
  direction: Direction
  contributions: AlertContribution[]
  createdAt: number
  read: boolean
}

export type SourceFetchStatus = 'ok' | 'failed' | 'disabled' | 'pending'

export interface SourceStateMeta {
  status: SourceFetchStatus
  /** Wall-clock time of the last fetch attempt. */
  lastCheckAt: number | null
  /** Date (YYYY-MM-DD) of the newest data point received. */
  latestDataDate: string | null
  /** Human readable failure reason (already localised). */
  error: string | null
  /** Machine-readable failure reason, drives actionable UI hints. */
  reason?: 'auth' | 'network' | 'parse' | 'rate-limited' | 'unavailable' | null
}

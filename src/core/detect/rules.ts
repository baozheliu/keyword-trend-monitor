/**
 * Alert template rules.
 *
 * Every rule returns a RuleEvaluation whose `score` is normalised so that
 * 1.0 equals the trigger threshold; the alert lifecycle uses the score for
 * its recovery logic (3 new points below 60%).
 */
import { SENSITIVITY_PARAMS, type SensitivityParams } from '../constants'
import type {
  CustomRuleConfig,
  Direction,
  RuleEvaluation,
  Sensitivity,
  Signal,
  TemplateId,
} from '../types'
import { extractFeatures, type SeriesFeatures } from './features'

/** EWMA control-chart limit (Roberts charts commonly use L ≈ 2.7..3). */
const EWMA_LIMIT = 2.7
/** CUSUM decision interval (NIST recommends h = 4..5 with k = 0.5). */
const CUSUM_LIMIT = 5

const NO_ALERT: Omit<RuleEvaluation, 'stage' | 'insufficientData'> = {
  triggered: false,
  direction: null,
  score: 0,
  signals: [],
}

function evaluation(
  features: SeriesFeatures,
  partial: Partial<RuleEvaluation>,
  insufficientData = false,
): RuleEvaluation {
  return {
    ...NO_ALERT,
    stage: features.stage,
    insufficientData,
    ...partial,
  }
}

function ratio(value: number | null | undefined, threshold: number): number {
  if (value === null || value === undefined || threshold <= 0) return 0
  return value / threshold
}

/** Collect the six voting signal categories for 智能监测. */
export function collectSignals(features: SeriesFeatures, params: SensitivityParams): Signal[] {
  const signals: Signal[] = []

  if (features.changePct7 !== null) {
    const strength = Math.abs(features.changePct7) / params.minChange
    signals.push({
      category: 'change',
      direction: features.changePct7 >= 0 ? 'up' : 'down',
      strength,
      detail: `Δ7d=${(features.changePct7 * 100).toFixed(1)}%`,
    })
  }

  if (features.robustScore7 !== null) {
    const strength = Math.abs(features.robustScore7) / params.madZ
    signals.push({
      category: 'robust',
      direction: features.robustScore7 >= 0 ? 'up' : 'down',
      strength,
      detail: `MADz=${features.robustScore7.toFixed(2)}`,
    })
  }

  const ewmaStrength = features.ewmaZ === null ? 0 : Math.abs(features.ewmaZ) / EWMA_LIMIT
  const cusumUpStrength = features.cusumHigh / CUSUM_LIMIT
  const cusumDownStrength = features.cusumLow / CUSUM_LIMIT
  const momentumUp = Math.max(features.ewmaZ !== null && features.ewmaZ > 0 ? ewmaStrength : 0, cusumUpStrength)
  const momentumDown = Math.max(features.ewmaZ !== null && features.ewmaZ < 0 ? ewmaStrength : 0, cusumDownStrength)
  if (momentumUp > 0 || momentumDown > 0) {
    const direction: Direction = momentumUp >= momentumDown ? 'up' : 'down'
    signals.push({
      category: 'momentum',
      direction,
      strength: Math.max(momentumUp, momentumDown),
      detail: `EWMAz=${features.ewmaZ?.toFixed(2) ?? '—'} CUSUM=${features.cusumHigh.toFixed(1)}/${features.cusumLow.toFixed(1)}`,
    })
  }

  if (features.slopeChangePct !== null && features.slopeChangePct !== 0) {
    signals.push({
      category: 'trend',
      direction: features.slopeChangePct > 0 ? 'up' : 'down',
      strength: Math.abs(features.slopeChangePct) / params.minChange,
      detail: `slope7≈${(features.slopeChangePct * 100).toFixed(1)}%/win`,
    })
  }

  if (features.crossedUp || features.crossedDown) {
    const gapStrength = features.crossoverGap === null
      ? 1
      : Math.abs(features.crossoverGap) / (params.minChange / 2)
    signals.push({
      category: 'crossover',
      direction: features.crossedUp ? 'up' : 'down',
      strength: Math.max(1, gapStrength),
      detail: 'MA7×MA28',
    })
  }

  if (features.changepoint) {
    signals.push({
      category: 'changepoint',
      direction: features.changepoint.direction,
      strength: Math.abs(features.changepoint.shiftPct) / params.minChange,
      detail: `shift=${(features.changepoint.shiftPct * 100).toFixed(1)}%`,
    })
  }

  return signals
}

/** 快速升温 (direction = 'up') / 异常下降 (direction = 'down'). */
function evaluateRapid(
  features: SeriesFeatures,
  params: SensitivityParams,
  direction: Direction,
): RuleEvaluation {
  if (!features.meetsRapidDataRequirements) {
    return evaluation(features, {}, true)
  }

  const sign = direction === 'up' ? 1 : -1
  const changeStrength = features.changePct3 === null
    ? 0
    : Math.max(0, sign * features.changePct3) / params.minChange
  const madStrength = features.robustScore3 === null
    ? 0
    : Math.max(0, sign * features.robustScore3) / params.madZ

  const score = Math.min(changeStrength, madStrength)
  const signals: Signal[] = [
    { category: 'change', direction, strength: changeStrength, detail: `Δ3d strength` },
    { category: 'robust', direction, strength: madStrength, detail: `MADz strength` },
  ]

  return evaluation(features, {
    triggered: score >= 1,
    direction: score > 0 ? direction : null,
    score,
    signals,
  })
}

/** 持续上升: rising days + positive slope + EWMA/CUSUM confirmation. */
function evaluateSustainedRise(features: SeriesFeatures, params: SensitivityParams): RuleEvaluation {
  if (!features.meetsFullDataRequirements) {
    return evaluation(features, {}, true)
  }

  const changeStrength = features.changePct7 === null
    ? 0
    : Math.max(0, features.changePct7) / params.minChange
  const risingStrength = features.risingDays7 / params.minRisingDays
  const slopeOk = (features.slope7 ?? 0) > 0

  const ewmaConfirm = features.ewmaZ !== null && features.ewmaZ > 0
    ? features.ewmaZ / EWMA_LIMIT
    : 0
  const cusumConfirm = features.cusumHigh / CUSUM_LIMIT
  const momentumStrength = Math.max(ewmaConfirm, cusumConfirm)

  const score = slopeOk
    ? Math.min(changeStrength, risingStrength, momentumStrength)
    : 0

  return evaluation(features, {
    triggered: score >= 1,
    direction: score > 0 ? 'up' : null,
    score,
    signals: [
      { category: 'change', direction: 'up', strength: changeStrength, detail: 'Δ7d' },
      { category: 'trend', direction: 'up', strength: risingStrength, detail: `${features.risingDays7} rising days` },
      { category: 'momentum', direction: 'up', strength: momentumStrength, detail: 'EWMA/CUSUM' },
    ],
  })
}

/** 趋势反转: flat/down slope turns positive + golden cross (+changepoint when extended). */
function evaluateTrendReversal(features: SeriesFeatures, params: SensitivityParams): RuleEvaluation {
  if (!features.meetsFullDataRequirements) {
    return evaluation(features, {}, true)
  }

  const prevNotPositive = (features.slopePrevMin ?? 0) <= 0
  const nowPositive = (features.slope7 ?? 0) > 0
  const crossed = features.crossedUp

  // Level confirmation: the recent week must actually sit above the
  // previous week; this is what separates a reversal from noise wiggles.
  const wowStrength = features.weekOverWeekPct === null
    ? 0
    : Math.max(0, features.weekOverWeekPct) / (params.minChange * 0.5)

  // Slope magnitude requirement scales with sensitivity (half the min change
  // across the window, because a reversal starts from a depressed level).
  const slopeStrength = features.slopeChangePct === null
    ? 0
    : Math.max(0, features.slopeChangePct) / (params.minChange * 0.5)

  // With ≥56 points, changepoint detection is added as a veto: a detected
  // *downward* level shift contradicts the reversal and blocks the alert.
  // (A gradual turn often has no sharp changepoint, which stays neutral.)
  let changepointOk = true
  if (features.stage === 'extended' && features.changepoint) {
    changepointOk = features.changepoint.direction === 'up'
  }

  const gates = prevNotPositive && nowPositive && crossed && changepointOk
  const score = gates
    ? Math.min(slopeStrength, wowStrength)
    : Math.min(slopeStrength, wowStrength, 0.5)

  return evaluation(features, {
    triggered: gates && score >= 1,
    direction: nowPositive ? 'up' : null,
    score,
    signals: [
      { category: 'trend', direction: 'up', strength: slopeStrength, detail: 'slope turned positive' },
      { category: 'change', direction: 'up', strength: wowStrength, detail: 'week-over-week level' },
      { category: 'crossover', direction: 'up', strength: crossed ? 1 : 0, detail: 'MA7×MA28' },
    ],
  })
}

/** 剧烈波动: recent MAD vs baseline MAD ratio + a real peak-trough move. */
function evaluateVolatility(features: SeriesFeatures, params: SensitivityParams): RuleEvaluation {
  if (!features.meetsFullDataRequirements) {
    return evaluation(features, {}, true)
  }

  const ratioStrength = ratio(features.volatilityRatio, params.volatilityRatio)
  // The peak-trough move must clearly exceed the plain change threshold —
  // volatility means swings, not the ordinary noise band.
  const rangeStrength = ratio(features.rangePct7, params.minChange * 1.5)
  const score = Math.min(ratioStrength, rangeStrength)

  return evaluation(features, {
    triggered: score >= 1,
    direction: score > 0 ? 'up' : null,
    score,
    signals: [
      { category: 'robust', direction: 'up', strength: ratioStrength, detail: 'MAD ratio' },
      { category: 'change', direction: 'up', strength: rangeStrength, detail: 'peak-trough' },
    ],
  })
}

/** 智能监测: minimum change + N distinct signal categories agreeing. */
function evaluateSmart(features: SeriesFeatures, params: SensitivityParams): RuleEvaluation {
  if (!features.meetsFullDataRequirements) {
    return evaluation(features, {}, true)
  }

  const signals = collectSignals(features, params)
  const byDirection = (direction: Direction) =>
    signals.filter(signal => signal.direction === direction && signal.strength >= 1)

  const upSignals = byDirection('up')
  const downSignals = byDirection('down')
  const direction: Direction = upSignals.length >= downSignals.length ? 'up' : 'down'
  const agreeing = direction === 'up' ? upSignals : downSignals

  const changeSignal = signals.find(signal => signal.category === 'change')
  const changeStrength = changeSignal && changeSignal.direction === direction
    ? changeSignal.strength
    : 0

  // Score: minimum change requirement AND the k-th strongest agreeing signal.
  const sameDirection = signals
    .filter(signal => signal.direction === direction)
    .map(signal => signal.strength)
    .sort((a, b) => b - a)
  const kth = sameDirection[params.minSignals - 1] ?? 0
  const score = Math.min(changeStrength, kth)

  const triggered = changeStrength >= 1 && agreeing.length >= params.minSignals

  return evaluation(features, {
    triggered,
    direction: score > 0 ? direction : null,
    score,
    signals,
  })
}

/** 自定义规则: direction + window change + streak length. */
function evaluateCustom(
  features: SeriesFeatures,
  config: CustomRuleConfig,
): RuleEvaluation {
  if (!features.meetsFullDataRequirements) {
    return evaluation(features, {}, true)
  }

  const sign = config.direction === 'up' ? 1 : -1
  const changePct = config.windowDays <= 3 ? features.changePct3 : features.changePct7
  const minChange = Math.max(config.minChangePct, 1) / 100
  const changeStrength = changePct === null
    ? 0
    : Math.max(0, sign * changePct) / minChange

  const streak = config.direction === 'up' ? features.streakUp : features.streakDown
  const streakStrength = config.minStreakDays > 0
    ? streak / config.minStreakDays
    : 1

  const score = Math.min(changeStrength, streakStrength)

  return evaluation(features, {
    triggered: score >= 1,
    direction: score > 0 ? config.direction : null,
    score,
    signals: [
      { category: 'change', direction: config.direction, strength: changeStrength, detail: 'custom Δ' },
      { category: 'trend', direction: config.direction, strength: streakStrength, detail: `streak=${streak}` },
    ],
  })
}

/**
 * Evaluate one keyword × source series under a template + sensitivity.
 *
 * Learning stages:
 * - `learning` (<14 valid points): never evaluates, charts only.
 * - `rapidOnly` (14–34): only the rapid-change rule runs, respecting the
 *   template's direction of interest.
 * - `full` (35+): the complete 7/28 cluster.
 * - `extended` (56+): adds changepoint detection.
 */
export function evaluateSeries(
  values: readonly (number | null)[],
  template: TemplateId,
  sensitivity: Sensitivity,
  custom: CustomRuleConfig | null = null,
): RuleEvaluation {
  const features = extractFeatures(values)
  const params = SENSITIVITY_PARAMS[sensitivity]

  if (features.stage === 'learning') {
    return evaluation(features, {}, true)
  }

  if (features.stage === 'rapidOnly') {
    // Only rapid-change rules run while learning; direction follows the template.
    if (template === 'abnormalDrop') return evaluateRapid(features, params, 'down')
    if (template === 'volatility' || template === 'trendReversal') {
      return evaluation(features, {}, true)
    }
    if (template === 'custom' && custom) {
      return evaluateRapid(features, params, custom.direction)
    }
    return evaluateRapid(features, params, 'up')
  }

  switch (template) {
    case 'rapidRise':
      return evaluateRapid(features, params, 'up')
    case 'abnormalDrop':
      return evaluateRapid(features, params, 'down')
    case 'sustainedRise':
      return evaluateSustainedRise(features, params)
    case 'trendReversal':
      return evaluateTrendReversal(features, params)
    case 'volatility':
      return evaluateVolatility(features, params)
    case 'custom':
      return custom ? evaluateCustom(features, custom) : evaluation(features, {}, true)
    case 'smart':
    default:
      return evaluateSmart(features, params)
  }
}

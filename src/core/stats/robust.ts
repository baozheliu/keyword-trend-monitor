/**
 * Median/MAD robust anomaly score ("robust z-score").
 *
 * score = (x - median(baseline)) / robustScale(baseline)
 *
 * Reference: Iglewicz & Hoaglin, "How to Detect and Handle Outliers" (1993),
 * modified z-score; implemented independently in TypeScript.
 */
import { median, robustScale } from './basic'

/** Scores are clamped to this magnitude to keep downstream math stable. */
export const MAX_ROBUST_SCORE = 50

/**
 * Robust anomaly score of `x` against a baseline sample.
 * When the baseline is constant (scale 0), any deviation is treated as a
 * strong anomaly relative to a small floor scale so that spikes on flat
 * series are still detected. Returns `null` when the baseline is empty.
 */
export function robustScore(x: number, baseline: readonly number[]): number | null {
  const base = median(baseline)
  const scale = robustScale(baseline)
  if (base === null || scale === null) return null

  const deviation = x - base
  if (deviation === 0) return 0

  if (scale === 0) {
    // Floor scale: 5% of the baseline level, but at least a small epsilon.
    const floor = Math.max(Math.abs(base) * 0.05, 1e-9)
    return clamp(deviation / floor)
  }

  return clamp(deviation / scale)
}

function clamp(score: number): number {
  if (score > MAX_ROBUST_SCORE) return MAX_ROBUST_SCORE
  if (score < -MAX_ROBUST_SCORE) return -MAX_ROBUST_SCORE
  return score
}

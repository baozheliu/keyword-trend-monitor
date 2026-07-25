/**
 * Offline changepoint detection for mean shifts using the PELT algorithm
 * (Pruned Exact Linear Time) with an L2 segment cost and a BIC-style
 * penalty.
 *
 * Reference: R. Killick, P. Fearnhead, I. A. Eckley,
 * "Optimal detection of changepoints with a linear computational cost",
 * JASA 107(500), 2012. Algorithm re-implemented independently in
 * TypeScript from the paper's pseudocode (no upstream code copied).
 */
import { robustScale } from './basic'

export interface ChangepointOptions {
  /** Explicit penalty; when omitted a BIC penalty from a robust sigma is used. */
  penalty?: number
  /** Minimum segment length in points. */
  minSegment?: number
}

/**
 * Returns changepoint indices: each index `i` marks that a new segment
 * starts at position `i` (0 < i < n). Missing values are removed prior to
 * detection; returned indices refer to the *valid-value* sequence, so the
 * caller keeps an index map when gaps matter.
 */
export function detectChangepoints(
  values: readonly number[],
  options: ChangepointOptions = {},
): number[] {
  const n = values.length
  const minSegment = Math.max(1, options.minSegment ?? 2)
  if (n < 2 * minSegment) return []

  // Prefix sums for O(1) L2 segment cost.
  const sum = new Float64Array(n + 1)
  const sumSq = new Float64Array(n + 1)
  for (let i = 0; i < n; i += 1) {
    const x = values[i]!
    sum[i + 1] = sum[i]! + x
    sumSq[i + 1] = sumSq[i]! + x * x
  }

  /** L2 cost of segment [start, end) — SSE around the segment mean. */
  const segmentCost = (start: number, end: number): number => {
    const length = end - start
    if (length <= 0) return 0
    const s = sum[end]! - sum[start]!
    const sq = sumSq[end]! - sumSq[start]!
    return sq - (s * s) / length
  }

  let penalty = options.penalty
  if (penalty === undefined) {
    // Robust sigma from first differences (less biased by the shifts themselves).
    const diffs: number[] = []
    for (let i = 1; i < n; i += 1) diffs.push(values[i]! - values[i - 1]!)
    const sigma = (robustScale(diffs) ?? 0) / Math.SQRT2
    const variance = Math.max(sigma * sigma, 1e-12)
    penalty = 3 * variance * Math.log(n)
  }

  // PELT dynamic program with pruning.
  const best = new Float64Array(n + 1).fill(Number.POSITIVE_INFINITY)
  best[0] = -penalty
  const lastChange = new Int32Array(n + 1).fill(0)
  let candidates: number[] = [0]

  for (let end = minSegment; end <= n; end += 1) {
    let bestCost = Number.POSITIVE_INFINITY
    let bestStart = 0

    for (const start of candidates) {
      if (end - start < minSegment) continue
      const cost = best[start]! + segmentCost(start, end) + penalty
      if (cost < bestCost) {
        bestCost = cost
        bestStart = start
      }
    }

    best[end] = bestCost
    lastChange[end] = bestStart

    // Pruning step: discard candidates that can never be optimal again.
    const pruned: number[] = []
    for (const start of candidates) {
      if (end - start < minSegment) {
        pruned.push(start)
        continue
      }
      if (best[start]! + segmentCost(start, end) <= bestCost) {
        pruned.push(start)
      }
    }
    pruned.push(end - minSegment + 1 > 0 ? end - minSegment + 1 : 0)

    // Keep unique, valid candidate starts.
    candidates = [...new Set(pruned)].filter(start => start >= 0 && start <= end)
  }

  // Backtrack.
  const changepoints: number[] = []
  let cursor = n
  while (cursor > 0) {
    const start = lastChange[cursor]!
    if (start === 0) break
    changepoints.push(start)
    cursor = start
  }

  return changepoints.sort((a, b) => a - b)
}

/**
 * Convenience helper: was a changepoint detected within the last
 * `recentPoints` valid observations, and in which direction did the level
 * move? Returns null when no recent changepoint exists.
 */
export function recentChangepoint(
  values: readonly number[],
  recentPoints: number,
  options: ChangepointOptions = {},
): { index: number, direction: 'up' | 'down', shift: number } | null {
  const changepoints = detectChangepoints(values, options)
  if (changepoints.length === 0) return null

  const lastCp = changepoints[changepoints.length - 1]!
  if (values.length - lastCp > recentPoints) return null

  const prevCp = changepoints.length > 1 ? changepoints[changepoints.length - 2]! : 0
  const before = values.slice(prevCp, lastCp)
  const after = values.slice(lastCp)
  if (before.length === 0 || after.length === 0) return null

  const beforeMean = before.reduce((a, b) => a + b, 0) / before.length
  const afterMean = after.reduce((a, b) => a + b, 0) / after.length
  const shift = afterMean - beforeMean
  if (shift === 0) return null

  return { index: lastCp, direction: shift > 0 ? 'up' : 'down', shift }
}

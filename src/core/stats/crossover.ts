/**
 * Short/long moving-average crossover detection (7d vs 28d by default).
 * A "golden cross" (up) means the short MA moved from at-or-below to above
 * the long MA within the last `lookback` days; "death cross" is the mirror.
 */
import { movingAverage } from './movingAverage'

export interface CrossoverResult {
  crossedUp: boolean
  crossedDown: boolean
  /** (shortMA - longMA) / |longMA| at the last point, or null. */
  gap: number | null
}

export function detectCrossover(
  values: readonly (number | null)[],
  shortWindow = 7,
  longWindow = 28,
  lookback = 3,
): CrossoverResult {
  const shortMa = movingAverage(values, shortWindow)
  const longMa = movingAverage(values, longWindow)

  const relation = (index: number): -1 | 0 | 1 | null => {
    const shortValue = shortMa[index] ?? null
    const longValue = longMa[index] ?? null
    if (shortValue === null || longValue === null) return null
    if (shortValue > longValue) return 1
    if (shortValue < longValue) return -1
    return 0
  }

  const last = values.length - 1
  const lastRelation = last >= 0 ? relation(last) : null

  let crossedUp = false
  let crossedDown = false

  if (lastRelation !== null) {
    for (let i = Math.max(1, last - lookback + 1); i <= last; i += 1) {
      const prev = relation(i - 1)
      const curr = relation(i)
      if (prev === null || curr === null) continue
      if (prev <= 0 && curr > 0 && lastRelation > 0) crossedUp = true
      if (prev >= 0 && curr < 0 && lastRelation < 0) crossedDown = true
    }
  }

  let gap: number | null = null
  const shortLast = shortMa[last] ?? null
  const longLast = longMa[last] ?? null
  if (shortLast !== null && longLast !== null) {
    gap = (shortLast - longLast) / Math.max(Math.abs(longLast), 1e-9)
  }

  return { crossedUp, crossedDown, gap }
}

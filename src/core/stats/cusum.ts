/**
 * Tabular (one-sided) CUSUM after Page (1954), as described in the
 * NIST/SEMATECH e-Handbook of Statistical Methods §6.3.2.3;
 * implemented independently in TypeScript.
 *
 * SH_i = max(0, SH_{i-1} + (x_i - mu) / sigma - k)
 * SL_i = max(0, SL_{i-1} - (x_i - mu) / sigma - k)
 *
 * A shift is signalled when SH (upward) or SL (downward) exceeds `h`.
 * Typical parameters: k = 0.5 (detects ~1 sigma shifts), h = 4..5.
 */

export interface CusumResult {
  /** Final upper cumulative sum (standardised units). */
  high: number
  /** Final lower cumulative sum (standardised units). */
  low: number
}

export function cusum(
  values: readonly (number | null)[],
  mu: number,
  sigma: number,
  k = 0.5,
): CusumResult {
  const scale = sigma > 0 ? sigma : Math.max(Math.abs(mu) * 0.05, 1e-9)

  let high = 0
  let low = 0

  for (const value of values) {
    if (value === null || value === undefined) continue
    const z = (value - mu) / scale
    high = Math.max(0, high + z - k)
    low = Math.max(0, low - z - k)
  }

  return { high, low }
}

/**
 * EWMA (exponentially weighted moving average) smoothing and control chart.
 *
 * Control chart follows Roberts (1959) as described in the
 * NIST/SEMATECH e-Handbook of Statistical Methods §6.3.2.4;
 * implemented independently in TypeScript.
 */

export interface EwmaChartResult {
  /** EWMA value at the last point. */
  ewma: number
  /**
   * Standardised distance of the last EWMA from the baseline mean, in units
   * of the asymptotic EWMA control limit sigma. |z| >= threshold signals.
   */
  z: number
}

/**
 * Plain EWMA smoothing. `null` gaps are skipped (the smoothed value carries
 * through). Returns an array aligned with the input; entries before the
 * first valid point are `null`.
 */
export function ewmaSeries(values: readonly (number | null)[], alpha: number): (number | null)[] {
  if (alpha <= 0 || alpha > 1) throw new RangeError('alpha must be in (0, 1]')

  const result: (number | null)[] = new Array(values.length).fill(null)
  let current: number | null = null

  for (let i = 0; i < values.length; i += 1) {
    const value = values[i] ?? null
    if (value !== null) {
      current = current === null ? value : alpha * value + (1 - alpha) * current
    }
    result[i] = current
  }

  return result
}

/**
 * EWMA control chart of `recent` observations against a baseline mean/scale.
 *
 * @param recent   recent observations (nulls skipped)
 * @param baselineMean  centre line (robust location of the baseline window)
 * @param baselineScale sigma estimate of the baseline window
 * @param alpha    smoothing weight (default 0.3, common chart choice)
 */
export function ewmaChart(
  recent: readonly (number | null)[],
  baselineMean: number,
  baselineScale: number,
  alpha = 0.3,
): EwmaChartResult | null {
  const smoothed = ewmaSeries(recent, alpha)
  const last = smoothed[smoothed.length - 1] ?? null
  if (last === null || last === undefined) return null

  // Asymptotic EWMA standard deviation: sigma * sqrt(alpha / (2 - alpha)).
  const ewmaSigma = baselineScale * Math.sqrt(alpha / (2 - alpha))
  if (ewmaSigma === 0) {
    const floor = Math.max(Math.abs(baselineMean) * 0.05, 1e-9)
    return { ewma: last, z: (last - baselineMean) / floor }
  }

  return { ewma: last, z: (last - baselineMean) / ewmaSigma }
}

/**
 * Basic descriptive statistics.
 *
 * Median / MAD / IQR / quantile / linear regression delegate to
 * simple-statistics (ISC, https://github.com/simple-statistics/simple-statistics).
 * All wrappers return `null` for empty input instead of throwing, because
 * upstream series regularly contain no valid points.
 */
import {
  interquartileRange as ssInterquartileRange,
  linearRegression as ssLinearRegression,
  mean as ssMean,
  medianAbsoluteDeviation as ssMedianAbsoluteDeviation,
  median as ssMedian,
  quantile as ssQuantile,
  standardDeviation as ssStandardDeviation,
} from 'simple-statistics'

/** Consistency constant so that MAD estimates sigma for normal data. */
export const MAD_TO_SIGMA = 1.4826

/** Consistency constant so that IQR estimates sigma for normal data. */
export const IQR_TO_SIGMA = 1 / 1.349

export function mean(values: readonly number[]): number | null {
  return values.length === 0 ? null : ssMean(values as number[])
}

export function median(values: readonly number[]): number | null {
  return values.length === 0 ? null : ssMedian(values as number[])
}

export function medianAbsoluteDeviation(values: readonly number[]): number | null {
  return values.length === 0 ? null : ssMedianAbsoluteDeviation(values as number[])
}

export function interquartileRange(values: readonly number[]): number | null {
  return values.length === 0 ? null : ssInterquartileRange(values as number[])
}

export function quantile(values: readonly number[], p: number): number | null {
  return values.length === 0 ? null : ssQuantile(values as number[], p)
}

export function standardDeviation(values: readonly number[]): number | null {
  return values.length === 0 ? null : ssStandardDeviation(values as number[])
}

/**
 * Robust scale estimate (sigma-consistent): MAD first, IQR as fallback when
 * the MAD degenerates to zero (e.g. more than half the points identical).
 * Returns 0 for constant series and `null` for empty input.
 */
export function robustScale(values: readonly number[]): number | null {
  if (values.length === 0) return null

  const mad = medianAbsoluteDeviation(values)
  if (mad !== null && mad > 0) return mad * MAD_TO_SIGMA

  const iqr = interquartileRange(values)
  if (iqr !== null && iqr > 0) return iqr * IQR_TO_SIGMA

  return 0
}

/**
 * Ordinary least squares slope of `values` against their index.
 * Ignores `null` entries but keeps their x positions, so gaps do not
 * compress time. Returns `null` with fewer than 2 valid points.
 */
export function slope(values: readonly (number | null)[]): number | null {
  const points: [number, number][] = []
  for (let i = 0; i < values.length; i += 1) {
    const value = values[i]
    if (value !== null && value !== undefined) points.push([i, value])
  }
  if (points.length < 2) return null

  const { m } = ssLinearRegression(points)
  return Number.isFinite(m) ? m : null
}

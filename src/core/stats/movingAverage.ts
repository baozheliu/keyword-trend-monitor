/**
 * Simple moving average over calendar-aligned values with missing data.
 * A window's average is `null` unless it contains at least `minValid`
 * valid points (missing values are never treated as zero).
 */
export function movingAverage(
  values: readonly (number | null)[],
  window: number,
  minValid = Math.max(1, Math.ceil(window / 2)),
): (number | null)[] {
  if (window <= 0) throw new RangeError('window must be positive')

  const result: (number | null)[] = new Array(values.length).fill(null)

  for (let i = 0; i < values.length; i += 1) {
    let sum = 0
    let count = 0
    for (let j = Math.max(0, i - window + 1); j <= i; j += 1) {
      const value = values[j]
      if (value !== null && value !== undefined) {
        sum += value
        count += 1
      }
    }
    result[i] = count >= minValid ? sum / count : null
  }

  return result
}

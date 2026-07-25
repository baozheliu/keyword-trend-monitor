import type { SeriesPoint } from './types'

/** Parse `YYYY-MM-DD` into a UTC timestamp (milliseconds). */
export function dateToUtc(date: string): number {
  return Date.parse(`${date}T00:00:00Z`)
}

export function utcToDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

export function addDays(date: string, days: number): string {
  return utcToDate(dateToUtc(date) + days * 86_400_000)
}

export function isValidDateString(date: unknown): date is string {
  return typeof date === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(date)
    && Number.isFinite(dateToUtc(date))
}

function isValidValue(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/**
 * Normalise raw points into a clean, ascending, per-day series:
 * - drops entries with malformed dates,
 * - keeps the newest valid value for duplicate dates (later entries win;
 *   a later null never overwrites an earlier valid value),
 * - keeps missing days as absent (never fills zeros).
 */
export function normalizeSeries(rawPoints: readonly SeriesPoint[]): SeriesPoint[] {
  const byDate = new Map<string, number | null>()

  for (const point of rawPoints) {
    if (!isValidDateString(point?.date)) continue
    const value = isValidValue(point.value) ? point.value : null
    const existing = byDate.get(point.date)
    if (value !== null || existing === undefined || existing === null) {
      byDate.set(point.date, value)
    }
  }

  return [...byDate.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([date, value]) => ({ date, value }))
}

/**
 * Expand a normalised series into a calendar-aligned array of values ending
 * at the last observed date. Absent days become `null` (missing, not zero).
 */
export function toCalendarValues(points: readonly SeriesPoint[]): { startDate: string, values: (number | null)[] } {
  if (points.length === 0) return { startDate: '', values: [] }

  const first = points[0]!
  const last = points[points.length - 1]!
  const start = dateToUtc(first.date)
  const end = dateToUtc(last.date)
  const dayCount = Math.round((end - start) / 86_400_000) + 1
  const values: (number | null)[] = new Array(dayCount).fill(null)

  for (const point of points) {
    const index = Math.round((dateToUtc(point.date) - start) / 86_400_000)
    values[index] = point.value
  }

  return { startDate: first.date, values }
}

/** Number of non-null points. */
export function countValid(values: readonly (number | null)[]): number {
  let count = 0
  for (const value of values) {
    if (value !== null) count += 1
  }
  return count
}

/** Non-null values only, order preserved. */
export function validValues(values: readonly (number | null)[]): number[] {
  const result: number[] = []
  for (const value of values) {
    if (value !== null) result.push(value)
  }
  return result
}

/** Last `days` entries of a calendar-aligned array. */
export function tail<T>(values: readonly T[], days: number): T[] {
  if (days <= 0) return []
  return values.slice(Math.max(0, values.length - days))
}

/** The `days` entries immediately before the last `offset` entries. */
export function windowBefore<T>(values: readonly T[], offset: number, days: number): T[] {
  const end = Math.max(0, values.length - offset)
  return values.slice(Math.max(0, end - days), end)
}

/**
 * Merge freshly fetched points into stored history, honouring the
 * "duplicate dates keep the newest valid value" rule, and cap length.
 */
export function mergeSeries(
  stored: readonly SeriesPoint[],
  incoming: readonly SeriesPoint[],
  maxDays: number,
): SeriesPoint[] {
  const merged = normalizeSeries([...stored, ...incoming])
  return merged.length > maxDays ? merged.slice(merged.length - maxDays) : merged
}

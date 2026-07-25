/**
 * Consecutive rise/fall counting over the tail of a series.
 * Comparisons use consecutive *valid* values (nulls are skipped, they
 * neither extend nor break a streak). Ties break the streak.
 */

export interface StreakResult {
  /** Consecutive rising steps ending at the last valid value. */
  up: number
  /** Consecutive falling steps ending at the last valid value. */
  down: number
}

export function trailingStreak(
  values: readonly (number | null)[],
  epsilon = 0,
): StreakResult {
  const valid: number[] = []
  for (const value of values) {
    if (value !== null && value !== undefined) valid.push(value)
  }

  let up = 0
  let down = 0

  for (let i = valid.length - 1; i > 0; i -= 1) {
    const delta = valid[i]! - valid[i - 1]!
    if (delta > epsilon && down === 0) {
      up += 1
    } else if (delta < -epsilon && up === 0) {
      down += 1
    } else {
      break
    }
  }

  return { up, down }
}

/** Count of rising steps among consecutive valid pairs in a window. */
export function risingDays(values: readonly (number | null)[], epsilon = 0): number {
  const valid: number[] = []
  for (const value of values) {
    if (value !== null && value !== undefined) valid.push(value)
  }

  let count = 0
  for (let i = 1; i < valid.length; i += 1) {
    if (valid[i]! - valid[i - 1]! > epsilon) count += 1
  }
  return count
}

/** Count of falling steps among consecutive valid pairs in a window. */
export function fallingDays(values: readonly (number | null)[], epsilon = 0): number {
  const valid: number[] = []
  for (const value of values) {
    if (value !== null && value !== undefined) valid.push(value)
  }

  let count = 0
  for (let i = 1; i < valid.length; i += 1) {
    if (valid[i]! - valid[i - 1]! < -epsilon) count += 1
  }
  return count
}

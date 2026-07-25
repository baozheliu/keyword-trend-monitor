import type { SeriesPoint } from '../core/types'

export interface KeywordFetchSuccess {
  ok: true
  keyword: string
  points: SeriesPoint[]
}

export interface KeywordFetchFailure {
  ok: false
  keyword: string
  /** Stable machine-readable reason. */
  reason: 'auth' | 'network' | 'parse' | 'rate-limited' | 'unavailable'
  detail: string
}

export type KeywordFetchResult = KeywordFetchSuccess | KeywordFetchFailure

export function fetchFailure(
  keyword: string,
  reason: KeywordFetchFailure['reason'],
  detail: string,
): KeywordFetchFailure {
  return { ok: false, keyword, reason, detail }
}

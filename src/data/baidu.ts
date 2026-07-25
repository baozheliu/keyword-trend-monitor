/**
 * Baidu Index (index.baidu.com) reader.
 *
 * Reads the same web API the logged-in Baidu Index site uses. The browser
 * attaches the user's own cookies (host permission + credentials:include);
 * no credentials are ever stored by the extension. When the user is not
 * logged in, has no access or the page shape changed, the fetch fails
 * gracefully — a failure is surfaced as a localized fetch-failed message
 * and is never interpreted as a trend decline.
 *
 * Flow (public knowledge, widely documented):
 *   1. GET /api/SearchApi/index?word=…&startDate=…&endDate=…&area=…
 *      → encrypted per-day values + `uniqid`
 *   2. GET /Interface/ptbk?uniqid=… → substitution key
 *   3. Decrypt: first half of the key maps characters to the second half.
 */
import { t } from '../app/i18n'
import { addDays } from '../core/series'
import type { SeriesPoint } from '../core/types'
import { baiduCipherText } from './baiduCipher'
import { fetchFailure, type KeywordFetchResult } from './types'

const BASE = 'https://index.baidu.com'

/** Decrypt Baidu's substitution cipher: ptbk[i] → ptbk[i + n]. */
export function decryptBaiduData(ptbk: string, encrypted: string): string {
  const half = Math.floor(ptbk.length / 2)
  const mapping = new Map<string, string>()
  for (let i = 0; i < half; i += 1) {
    mapping.set(ptbk[i]!, ptbk[half + i]!)
  }
  let result = ''
  for (const char of encrypted) {
    result += mapping.get(char) ?? ''
  }
  return result
}

/**
 * Expand a decrypted comma-separated value list into daily points.
 * Empty entries stay missing (`null`) — they are never zero-filled.
 */
export function baiduValuesToPoints(
  decrypted: string,
  startDate: string,
  endDate: string,
): SeriesPoint[] {
  const parts = decrypted.split(',')
  const points: SeriesPoint[] = []
  let date = startDate
  for (const part of parts) {
    if (date > endDate) break
    const value = part === '' ? null : Number(part)
    points.push({ date, value: value !== null && Number.isFinite(value) ? value : null })
    date = addDays(date, 1)
  }
  return points
}

interface BaiduSearchResponse {
  status?: number
  message?: string
  data?: {
    uniqid?: string
    userIndexes?: Array<{
      word?: Array<{ name?: string }>
      all?: { data?: string, startDate?: string, endDate?: string }
    }>
  }
}

/** Network stalls must not wedge the whole check cycle. */
const FETCH_TIMEOUT_MS = 12_000

class BaiduHttpError extends Error {}
class BaiduAntiBotError extends Error {}

async function fetchJson(url: string, cipherText?: string): Promise<unknown> {
  const headers: Record<string, string> = {
    Accept: 'application/json, text/plain, */*',
  }
  // Anti-bot token required by SearchApi since ~2023 (see baiduCipher.ts).
  if (cipherText) headers['Cipher-Text'] = cipherText
  const response = await fetch(url, {
    credentials: 'include',
    headers,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (!response.ok) {
    throw new BaiduHttpError(`HTTP ${response.status}`)
  }
  const text = await response.text()
  try {
    return JSON.parse(text)
  } catch {
    // A 200 that isn't JSON means Baidu served an anti-bot / security-check
    // HTML page instead of data — surface it distinctly, not as a decline.
    throw new BaiduAntiBotError(t('baiduAntiBot'))
  }
}

export interface BaiduFetchOptions {
  /** Baidu area code; '' or '0' = nationwide. */
  area?: string
  /** Number of trailing days to request. */
  days?: number
  /** Injectable clock for tests. */
  today?: string
}

/**
 * Fetch the daily Baidu index ("all" = PC+mobile) for one keyword.
 */
export async function fetchBaiduIndex(
  keyword: string,
  options: BaiduFetchOptions = {},
): Promise<KeywordFetchResult> {
  const area = options.area && options.area !== '' ? options.area : '0'
  const days = options.days ?? 90
  const today = options.today ?? new Date().toISOString().slice(0, 10)
  const endDate = addDays(today, -1) // yesterday: the last complete day
  const startDate = addDays(endDate, -(days - 1))

  const word = encodeURIComponent(JSON.stringify([[{ name: keyword, wordType: 1 }]]))
  const searchUrl = `${BASE}/api/SearchApi/index?area=${encodeURIComponent(area)}&word=${word}`
    + `&startDate=${startDate}&endDate=${endDate}`

  let payload: BaiduSearchResponse
  try {
    payload = await fetchJson(searchUrl, await baiduCipherText(keyword)) as BaiduSearchResponse
  } catch (error) {
    if (error instanceof BaiduAntiBotError) {
      return fetchFailure(keyword, 'rate-limited', t('baiduRateLimited'))
    }
    return fetchFailure(keyword, 'network', t('baiduRequestFailed', String(error)))
  }

  if (payload.status !== 0 || !payload.data) {
    // status 10000/10002 → not logged in / no permission.
    if (payload.status === 10000 || payload.status === 10002) {
      return fetchFailure(keyword, 'auth', t('baiduAuth'))
    }
    if (payload.status === 10018) {
      // Anti-bot gate: the Cipher-Text token was rejected.
      return fetchFailure(keyword, 'rate-limited', t('baiduRateLimited'))
    }
    return fetchFailure(keyword, 'unavailable', payload.message || `status=${payload.status}`)
  }

  const uniqid = payload.data.uniqid
  const encrypted = payload.data.userIndexes?.[0]?.all?.data
  if (!uniqid || encrypted === undefined) {
    return fetchFailure(keyword, 'parse', t('baiduParse'))
  }

  let ptbk: string
  try {
    const ptbkPayload = await fetchJson(`${BASE}/Interface/ptbk?uniqid=${encodeURIComponent(uniqid)}`) as { status?: number, data?: string }
    if (ptbkPayload.status !== 0 || typeof ptbkPayload.data !== 'string' || ptbkPayload.data.length === 0) {
      return fetchFailure(keyword, 'parse', t('baiduKeyFailed'))
    }
    ptbk = ptbkPayload.data
  } catch (error) {
    if (error instanceof BaiduAntiBotError) {
      return fetchFailure(keyword, 'rate-limited', t('baiduRateLimited'))
    }
    return fetchFailure(keyword, 'network', t('baiduKeyRequestFailed', String(error)))
  }

  const rangeStart = payload.data.userIndexes?.[0]?.all?.startDate || startDate
  const rangeEnd = payload.data.userIndexes?.[0]?.all?.endDate || endDate

  try {
    const decrypted = encrypted === '' ? '' : decryptBaiduData(ptbk, encrypted)
    const points = decrypted === ''
      ? []
      : baiduValuesToPoints(decrypted, rangeStart, rangeEnd)
    return { ok: true, keyword, points }
  } catch {
    return fetchFailure(keyword, 'parse', t('baiduDecryptFailed'))
  }
}

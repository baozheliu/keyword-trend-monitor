/**
 * Google Trends (trends.google.com) reader.
 *
 * Uses the public, login-free web endpoints that back the Trends site
 * (the same flow as the widely used pytrends project — re-implemented
 * independently here):
 *   1. GET /trends/api/explore  → widget list with per-widget tokens
 *   2. GET /trends/api/widgetdata/multiline?token=… → timeline JSON
 * Both responses carry an anti-JSON-hijacking prefix (")]}'") that must be
 * stripped. No API key and no Google account are required. Failures show
 * a localized fetch-failed message and never count as a trend decline.
 */
import { t } from '../app/i18n'
import type { SeriesPoint } from '../core/types'
import { fetchFailure, type KeywordFetchResult } from './types'

const BASE = 'https://trends.google.com'

/** Strip the anti-hijacking prefix and parse the JSON body. */
export function parseTrendsJson(raw: string): unknown {
  const start = raw.indexOf('{')
  if (start === -1) throw new Error('no JSON object found')
  return JSON.parse(raw.slice(start))
}

interface TimelinePoint {
  time?: string
  value?: number[]
  hasData?: boolean[]
  isPartial?: boolean
}

/** Convert widgetdata timeline entries to daily points (partial days skipped). */
export function timelineToPoints(timeline: readonly TimelinePoint[]): SeriesPoint[] {
  const points: SeriesPoint[] = []
  for (const entry of timeline) {
    const seconds = Number(entry.time)
    if (!Number.isFinite(seconds)) continue
    // Today's data point is partial and would distort the day-over-day math.
    if (entry.isPartial) continue
    const date = new Date(seconds * 1000).toISOString().slice(0, 10)
    const hasData = entry.hasData?.[0]
    const value = entry.value?.[0]
    points.push({
      date,
      value: hasData === false || typeof value !== 'number' || !Number.isFinite(value)
        ? null
        : value,
    })
  }
  return points
}

/** Network stalls (e.g. blocked routes) must not wedge the check cycle. */
const FETCH_TIMEOUT_MS = 12_000

async function fetchText(url: string): Promise<{ status: number, body: string }> {
  // credentials:include lets the browser send Trends' own session cookies
  // (set by the warm-up request below). No login is ever required.
  const response = await fetch(url, {
    credentials: 'include',
    headers: { Accept: 'application/json, text/plain, */*' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  return { status: response.status, body: response.ok ? await response.text() : '' }
}

/**
 * The explore API often answers 429 to "cold" clients without the cookies
 * the Trends site itself sets. Fetching the HTML page once per session
 * (same trick as pytrends' GetGoogleCookie) makes the API reliable.
 */
let warmedUpAt = 0
const WARM_UP_TTL_MS = 30 * 60 * 1000

async function warmUpSession(force = false): Promise<void> {
  if (!force && Date.now() - warmedUpAt < WARM_UP_TTL_MS) return
  try {
    await fetch(`${BASE}/trends/explore?hl=en-US`, {
      credentials: 'include',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
  } catch {
    // Best effort only; the API call below reports the real failure.
  }
  warmedUpAt = Date.now()
}

export interface GoogleFetchOptions {
  /** ISO country/region code, '' = worldwide. */
  geo?: string
  /** Language for the API (display strings are unused). */
  hl?: string
}

/**
 * Fetch the last ~90 days ("today 3-m", daily resolution) of interest for
 * one keyword. Longer ranges only return weekly data, so the extension
 * accumulates its own daily history locally over time.
 */
export async function fetchGoogleTrends(
  keyword: string,
  options: GoogleFetchOptions = {},
): Promise<KeywordFetchResult> {
  const geo = options.geo ?? ''
  const hl = options.hl ?? 'en-US'
  const tz = String(-new Date().getTimezoneOffset())

  const exploreReq = JSON.stringify({
    comparisonItem: [{ keyword, geo, time: 'today 3-m' }],
    category: 0,
    property: '',
  })
  const exploreUrl = `${BASE}/trends/api/explore?hl=${encodeURIComponent(hl)}&tz=${tz}&req=${encodeURIComponent(exploreReq)}`

  let widget: { token?: string, request?: unknown } | undefined
  try {
    await warmUpSession()
    let { status, body } = await fetchText(exploreUrl)
    if (status === 429) {
      // Cold session: refresh cookies once and retry.
      await warmUpSession(true)
      ;({ status, body } = await fetchText(exploreUrl))
    }
    if (status === 429) return fetchFailure(keyword, 'rate-limited', t('googleRateLimited'))
    if (status !== 200 || !body) return fetchFailure(keyword, 'network', `HTTP ${status}`)

    const parsed = parseTrendsJson(body) as { widgets?: Array<{ id?: string, token?: string, request?: unknown }> }
    widget = parsed.widgets?.find(w => w.id === 'TIMESERIES')
    if (!widget?.token || !widget.request) {
      return fetchFailure(keyword, 'parse', t('googleParse'))
    }
  } catch (error) {
    return fetchFailure(keyword, 'network', t('googleRequestFailed', String(error)))
  }

  const dataUrl = `${BASE}/trends/api/widgetdata/multiline?hl=${encodeURIComponent(hl)}&tz=${tz}`
    + `&req=${encodeURIComponent(JSON.stringify(widget.request))}`
    + `&token=${encodeURIComponent(widget.token)}`

  try {
    const { status, body } = await fetchText(dataUrl)
    if (status === 429) return fetchFailure(keyword, 'rate-limited', t('googleRateLimited'))
    if (status !== 200 || !body) return fetchFailure(keyword, 'network', `HTTP ${status}`)

    const parsed = parseTrendsJson(body) as { default?: { timelineData?: TimelinePoint[] } }
    const timeline = parsed.default?.timelineData
    if (!Array.isArray(timeline)) {
      return fetchFailure(keyword, 'parse', t('googleTimelineParse'))
    }
    return { ok: true, keyword, points: timelineToPoints(timeline) }
  } catch (error) {
    return fetchFailure(keyword, 'network', t('googleDataRequestFailed', String(error)))
  }
}

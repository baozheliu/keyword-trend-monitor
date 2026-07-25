/**
 * The periodic check: fetch fresh data per keyword × source, merge into
 * local history, run the detection engine and record merged alerts.
 */
import { t } from '../app/i18n'
import { runSubscription, SOURCE_IDS, type SeriesBundle } from '../core/detect/engine'
import type {
  AlertRecord,
  SourceId,
  SourceStateMeta,
  Subscription,
} from '../core/types'
import { fetchBaiduIndex } from '../data/baidu'
import { fetchGoogleTrends } from '../data/google'
import {
  addAlert,
  appendSeries,
  getSeries,
  getSourceMeta,
  getSubscriptions,
  getUnitStates,
  mergeUnitStates,
  setLastCheckAt,
  setSourceMeta,
} from '../store/repo'
import { updateBadge } from './badge'

/** A source is refetched at most once per this window (hourly cadence). */
const MIN_FETCH_INTERVAL_MS = 55 * 60 * 1000
/** Pause between consecutive network requests, to stay polite. */
const REQUEST_GAP_MS = 600

let inFlight: Promise<void> | null = null

export function isChecking(): boolean {
  return inFlight !== null
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function sourceLabel(source: SourceId): string {
  return source === 'baidu' ? t('sourceBaidu') : t('sourceGoogle')
}

/**
 * Live login probe: Baidu's BDUSS session cookie exists iff the user is
 * logged in. Only presence is checked — the value is never read or stored.
 */
export async function isBaiduLoggedIn(): Promise<boolean> {
  try {
    const cookie = await chrome.cookies.get({ url: 'https://index.baidu.com/', name: 'BDUSS' })
    return cookie !== null
  } catch {
    return true // Probe unavailable: don't nag the user about logging in.
  }
}

function alertMessage(subscription: Subscription, direction: 'up' | 'down'): string {
  if (subscription.template === 'volatility') {
    return t('alertVolatility', subscription.name)
  }
  return direction === 'up'
    ? t('alertRise', subscription.name)
    : t('alertDrop', subscription.name)
}

async function fetchSource(
  subscription: Subscription,
  source: SourceId,
  force: boolean,
  now: number,
): Promise<void> {
  const meta = await getSourceMeta(subscription.id, source)
  if (!force && meta.lastCheckAt !== null && now - meta.lastCheckAt < MIN_FETCH_INTERVAL_MS) {
    return
  }

  let anySuccess = false
  let lastError: string | null = null
  let lastReason: SourceStateMeta['reason'] = null
  let latestDataDate = meta.latestDataDate

  for (const keyword of subscription.keywords) {
    const area = subscription.sources[source].area
    const result = source === 'baidu'
      ? await fetchBaiduIndex(keyword, { area })
      : await fetchGoogleTrends(keyword, { geo: area })

    if (result.ok) {
      anySuccess = true
      const merged = await appendSeries(subscription.id, source, keyword, result.points)
      const newest = merged[merged.length - 1]?.date ?? null
      if (newest && (!latestDataDate || newest > latestDataDate)) {
        latestDataDate = newest
      }
    } else {
      lastError = result.detail
      lastReason = result.reason
    }

    await sleep(REQUEST_GAP_MS + Math.floor(Math.random() * 300))
  }

  // A failed Baidu check while logged out is a login problem regardless of
  // how the request failed — classify it so the UI can offer the login shortcut.
  if (!anySuccess && source === 'baidu' && !(await isBaiduLoggedIn())) {
    lastReason = 'auth'
    lastError = t('baiduNotLoggedIn')
  }

  const nextMeta: SourceStateMeta = {
    status: anySuccess ? 'ok' : 'failed',
    lastCheckAt: now,
    latestDataDate,
    error: anySuccess ? null : (lastError ?? t('sourceFetchFailed', sourceLabel(source))),
    reason: anySuccess ? null : lastReason,
  }
  if (!anySuccess) {
    // Surfaced in the service-worker console so a live failure is diagnosable
    // (open chrome://extensions → the extension → “Service Worker” → console).
    console.warn(
      `[KeywordWatch] ${t('sourceFetchFailed', sourceLabel(source))} reason=${lastReason ?? 'unknown'}: ${lastError ?? ''}`,
    )
  }
  await setSourceMeta(subscription.id, source, nextMeta)
}

async function loadBundle(subscription: Subscription): Promise<SeriesBundle> {
  const bundle: SeriesBundle = {}
  for (const source of SOURCE_IDS) {
    if (!subscription.sources[source].enabled) continue
    const bySource: Record<string, Awaited<ReturnType<typeof getSeries>>> = {}
    for (const keyword of subscription.keywords) {
      bySource[keyword] = await getSeries(subscription.id, source, keyword)
    }
    bundle[source] = bySource
  }
  return bundle
}

async function evaluateSubscription(subscription: Subscription): Promise<void> {
  const bundle = await loadBundle(subscription)
  const states = await getUnitStates()
  const result = runSubscription(subscription, bundle, states)

  if (Object.keys(result.states).length > 0) {
    await mergeUnitStates(result.states)
  }

  if (result.fired.length > 0 && result.direction) {
    const alert: AlertRecord = {
      id: `alert-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      subscriptionId: subscription.id,
      message: alertMessage(subscription, result.direction),
      direction: result.direction,
      contributions: result.fired,
      createdAt: Date.now(),
      read: false,
    }
    await addAlert(alert)
  }
}

export interface CheckOptions {
  /** Manual refresh bypasses the per-source hourly throttle. */
  force?: boolean
  /** Restrict fetching to one source (e.g. Baidu right after login). */
  only?: SourceId
}

/**
 * Run one complete check. Concurrent invocations share the in-flight run.
 */
export function runCheck(options: CheckOptions = {}): Promise<void> {
  if (inFlight) return inFlight
  inFlight = doCheck(options).finally(() => {
    inFlight = null
  })
  return inFlight
}

async function doCheck(options: CheckOptions): Promise<void> {
  {
    const now = Date.now()
    const subscriptions = await getSubscriptions()

    for (const subscription of subscriptions) {
      if (!subscription.enabled) continue

      for (const source of SOURCE_IDS) {
        if (!subscription.sources[source].enabled) continue
        if (options.only && source !== options.only) continue
        try {
          await fetchSource(subscription, source, options.force ?? false, now)
        } catch (error) {
          await setSourceMeta(subscription.id, source, {
            status: 'failed',
            lastCheckAt: now,
            latestDataDate: (await getSourceMeta(subscription.id, source)).latestDataDate,
            error: t('sourceFetchFailedWithDetail', [sourceLabel(source), String(error)]),
          })
        }
      }

      // Evaluation is driven by stored data dates, so unchanged data can
      // never re-trigger (no recompute / re-alert when data is unchanged).
      await evaluateSubscription(subscription)
    }

    await setLastCheckAt(now)
    await updateBadge()
  }
}

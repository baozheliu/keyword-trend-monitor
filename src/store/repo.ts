/**
 * Storage repositories for subscriptions, series, alerts, lifecycle state,
 * per-source status metadata and uploaded icons.
 */
import { LIMITS } from '../core/constants'
import { mergeSeries } from '../core/series'
import type {
  AlertRecord,
  SeriesPoint,
  SourceId,
  SourceStateMeta,
  Subscription,
  UnitAlertState,
} from '../core/types'
import { dbGet, dbKeysWithPrefix, dbRemove, dbSet, nsKey } from './db'

const SUBSCRIPTIONS_KEY = nsKey('subs')
const ALERTS_KEY = nsKey('alerts')
const UNIT_STATES_KEY = nsKey('unitStates')
const LAST_CHECK_KEY = nsKey('lastCheckAt')
const SEEDED_KEY = nsKey('seeded')

const MAX_STORED_ALERTS = 100

// ---------------------------------------------------------------- subscriptions

export async function getSubscriptions(): Promise<Subscription[]> {
  return dbGet<Subscription[]>(SUBSCRIPTIONS_KEY, [])
}

export async function saveSubscriptions(subscriptions: Subscription[]): Promise<void> {
  await dbSet(SUBSCRIPTIONS_KEY, subscriptions.slice(0, LIMITS.maxSubscriptions))
}

export async function wasSeeded(): Promise<boolean> {
  return dbGet<boolean>(SEEDED_KEY, false)
}

export async function markSeeded(): Promise<void> {
  await dbSet(SEEDED_KEY, true)
}

/** Remove a subscription and every piece of data that belongs to it. */
export async function deleteSubscriptionData(subscriptionId: string): Promise<void> {
  const prefixes = [
    nsKey('series', subscriptionId),
    nsKey('meta', subscriptionId),
    nsKey('icon', subscriptionId),
  ]
  for (const prefix of prefixes) {
    const keys = await dbKeysWithPrefix(prefix)
    if (keys.length > 0) await dbRemove(keys)
  }

  // Drop lifecycle states of this subscription.
  const states = await getUnitStates()
  const kept: Record<string, UnitAlertState> = {}
  for (const [key, state] of Object.entries(states)) {
    if (!key.startsWith(`${subscriptionId}\u0000`)) kept[key] = state
  }
  await dbSet(UNIT_STATES_KEY, kept)

  // Drop its alerts.
  const alerts = await getAlerts()
  await dbSet(ALERTS_KEY, alerts.filter(alert => alert.subscriptionId !== subscriptionId))
}

// ---------------------------------------------------------------------- series

function seriesKey(subscriptionId: string, source: SourceId, keyword: string): string {
  return nsKey('series', subscriptionId, source, encodeURIComponent(keyword))
}

export async function getSeries(
  subscriptionId: string,
  source: SourceId,
  keyword: string,
): Promise<SeriesPoint[]> {
  return dbGet<SeriesPoint[]>(seriesKey(subscriptionId, source, keyword), [])
}

/** Merge new points into history; returns the merged series. */
export async function appendSeries(
  subscriptionId: string,
  source: SourceId,
  keyword: string,
  incoming: SeriesPoint[],
): Promise<SeriesPoint[]> {
  const stored = await getSeries(subscriptionId, source, keyword)
  const merged = mergeSeries(stored, incoming, LIMITS.maxHistoryDays)
  await dbSet(seriesKey(subscriptionId, source, keyword), merged)
  return merged
}

// ---------------------------------------------------------------------- alerts

export async function getAlerts(): Promise<AlertRecord[]> {
  return dbGet<AlertRecord[]>(ALERTS_KEY, [])
}

export async function addAlert(alert: AlertRecord): Promise<void> {
  const alerts = await getAlerts()
  alerts.unshift(alert)
  await dbSet(ALERTS_KEY, alerts.slice(0, MAX_STORED_ALERTS))
}

export async function markAllAlertsRead(): Promise<void> {
  const alerts = await getAlerts()
  await dbSet(ALERTS_KEY, alerts.map(alert => ({ ...alert, read: true })))
}

export async function unreadAlertCount(): Promise<number> {
  const alerts = await getAlerts()
  return alerts.filter(alert => !alert.read).length
}

// ------------------------------------------------------------- lifecycle state

export async function getUnitStates(): Promise<Record<string, UnitAlertState>> {
  return dbGet<Record<string, UnitAlertState>>(UNIT_STATES_KEY, {})
}

export async function mergeUnitStates(patch: Record<string, UnitAlertState>): Promise<void> {
  const states = await getUnitStates()
  await dbSet(UNIT_STATES_KEY, { ...states, ...patch })
}

// -------------------------------------------------------------- source status

function metaKey(subscriptionId: string, source: SourceId): string {
  return nsKey('meta', subscriptionId, source)
}

export async function getSourceMeta(
  subscriptionId: string,
  source: SourceId,
): Promise<SourceStateMeta> {
  return dbGet<SourceStateMeta>(metaKey(subscriptionId, source), {
    status: 'pending',
    lastCheckAt: null,
    latestDataDate: null,
    error: null,
  })
}

export async function setSourceMeta(
  subscriptionId: string,
  source: SourceId,
  meta: SourceStateMeta,
): Promise<void> {
  await dbSet(metaKey(subscriptionId, source), meta)
}

// ---------------------------------------------------------------------- icons

export async function getIconImage(subscriptionId: string): Promise<string | null> {
  return dbGet<string | null>(nsKey('icon', subscriptionId), null)
}

export async function setIconImage(subscriptionId: string, dataUrl: string): Promise<void> {
  await dbSet(nsKey('icon', subscriptionId), dataUrl)
}

// ------------------------------------------------------------------ last check

export async function getLastCheckAt(): Promise<number | null> {
  return dbGet<number | null>(LAST_CHECK_KEY, null)
}

export async function setLastCheckAt(timestamp: number): Promise<void> {
  await dbSet(LAST_CHECK_KEY, timestamp)
}

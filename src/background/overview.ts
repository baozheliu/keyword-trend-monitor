/**
 * Builds the popup's overview payload from stored state.
 */
import { learningStage } from '../core/detect/features'
import { SOURCE_IDS } from '../core/detect/engine'
import { countValid, toCalendarValues } from '../core/series'
import type { SourceId } from '../core/types'
import {
  getAlerts,
  getIconImage,
  getLastCheckAt,
  getSeries,
  getSourceMeta,
  getSubscriptions,
  unreadAlertCount,
} from '../store/repo'
import type { OverviewPayload, SourceView, SubscriptionView } from '../app/messages'
import { isBaiduLoggedIn, isChecking } from './checker'

/** Alerts newer than this still mark dots on the charts. */
const ALERT_DOT_WINDOW_MS = 14 * 24 * 60 * 60 * 1000

export async function buildOverview(rangeDays: number): Promise<OverviewPayload> {
  const subscriptions = await getSubscriptions()
  const alerts = await getAlerts()
  const views: SubscriptionView[] = []

  for (const subscription of subscriptions) {
    const subAlerts = alerts.filter(alert => alert.subscriptionId === subscription.id)
    const latestAlert = subAlerts[0] ?? null
    const recentAlerts = subAlerts.filter(a => Date.now() - a.createdAt < ALERT_DOT_WINDOW_MS)

    const sources: SubscriptionView['sources'] = {}
    for (const source of SOURCE_IDS) {
      if (!subscription.sources[source].enabled) continue
      sources[source] = await buildSourceView(subscription.id, source, subscription.keywords, rangeDays, recentAlerts)
    }

    views.push({
      subscription,
      iconImage: subscription.icon.kind === 'image' ? await getIconImage(subscription.id) : null,
      latestAlert,
      sources,
    })
  }

  return {
    lastCheckAt: await getLastCheckAt(),
    unreadCount: await unreadAlertCount(),
    checking: isChecking(),
    baiduLoggedIn: await isBaiduLoggedIn(),
    subscriptions: views,
  }
}

async function buildSourceView(
  subscriptionId: string,
  source: SourceId,
  keywords: string[],
  rangeDays: number,
  recentAlerts: Awaited<ReturnType<typeof getAlerts>>,
): Promise<SourceView> {
  const meta = await getSourceMeta(subscriptionId, source)
  const series: SourceView['series'] = {}
  let anyBeyondLearning = false

  for (const keyword of keywords) {
    const points = await getSeries(subscriptionId, source, keyword)
    const { values } = toCalendarValues(points)
    if (learningStage(countValid(values)) !== 'learning') {
      anyBeyondLearning = true
    }
    series[keyword] = points.slice(Math.max(0, points.length - rangeDays))
  }

  const alertDates = [...new Set(
    recentAlerts.flatMap(alert => alert.contributions
      .filter(c => c.source === source)
      .map(c => c.dataDate)),
  )]

  return { meta, series, alertDates, learning: !anyBeyondLearning }
}

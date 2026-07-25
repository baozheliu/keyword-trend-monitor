/**
 * Background service worker: hourly checks, catch-up on browser restart,
 * message routing for the popup/options UIs, badge upkeep.
 */
import { t } from '../app/i18n'
import { LIMITS } from '../core/constants'
import {
  createDefaultSubscription,
  normalizeSubscription,
  validateSubscriptionInput,
} from '../core/subscriptions'
import type { Subscription } from '../core/types'
import {
  deleteSubscriptionData,
  getIconImage,
  getSubscriptions,
  getLastCheckAt,
  markAllAlertsRead,
  markSeeded,
  saveSubscriptions,
  setIconImage,
  wasSeeded,
} from '../store/repo'
import { Msg, type ExtensionRequest, type ExtensionResponse } from '../app/messages'
import { buildOverview } from './overview'
import { runCheck } from './checker'
import { updateBadge } from './badge'

const CHECK_ALARM = 'kw-hourly-check'
/** A check is due when the last one is older than this. */
const CHECK_DUE_MS = 55 * 60 * 1000

function ensureAlarm(): void {
  chrome.alarms.create(CHECK_ALARM, {
    periodInMinutes: LIMITS.checkIntervalMinutes,
    delayInMinutes: 1,
  })
}

async function checkIfDue(): Promise<void> {
  const lastCheckAt = await getLastCheckAt()
  if (lastCheckAt === null || Date.now() - lastCheckAt >= CHECK_DUE_MS) {
    await runCheck()
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  ensureAlarm()
  if (!(await wasSeeded())) {
    await saveSubscriptions([createDefaultSubscription()])
    await markSeeded()
  }
  await updateBadge()
  void runCheck()
})

// Browser start after shutdown/sleep: catch up immediately.
chrome.runtime.onStartup.addListener(() => {
  ensureAlarm()
  void checkIfDue()
})

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === CHECK_ALARM) {
    void checkIfDue()
  }
})

// When the user logs in to Baidu (BDUSS session cookie appears), refetch
// Baidu data right away instead of waiting for the next hourly check.
// Only the cookie's existence is observed — its value is never read or stored.
let loginRefreshTimer: ReturnType<typeof setTimeout> | undefined
chrome.cookies.onChanged.addListener(({ cookie, removed }) => {
  if (removed || cookie.name !== 'BDUSS' || !cookie.domain.includes('baidu.com')) return
  clearTimeout(loginRefreshTimer)
  // Login sets several cookies in a burst; debounce to a single check.
  loginRefreshTimer = setTimeout(() => {
    void runCheck({ force: true, only: 'baidu' })
  }, 3_000)
})

type Handler = (payload: Record<string, unknown>) => Promise<unknown>

const handlers: Record<string, Handler> = {
  [Msg.getOverview]: async (payload) => {
    const rangeDays = clampRange(payload.rangeDays)
    return buildOverview(rangeDays)
  },

  [Msg.refreshNow]: async () => {
    await runCheck({ force: true })
    return { done: true }
  },

  [Msg.listSubscriptions]: async () => getSubscriptions(),

  [Msg.saveSubscription]: async (payload) => {
    const input = payload.subscription as Partial<Subscription>
    const subscriptions = await getSubscriptions()
    const index = subscriptions.findIndex(sub => sub.id === input.id)

    const error = validateSubscriptionInput(input, subscriptions.length, index === -1)
    if (error) throw new Error(error)

    const normalized = normalizeSubscription({
      ...input,
      createdAt: index >= 0 ? subscriptions[index]!.createdAt : Date.now(),
    })

    if (index >= 0) {
      subscriptions[index] = normalized
    } else {
      subscriptions.push(normalized)
    }
    await saveSubscriptions(subscriptions)
    return normalized
  },

  [Msg.deleteSubscription]: async (payload) => {
    const id = String(payload.id ?? '')
    const subscriptions = await getSubscriptions()
    await saveSubscriptions(subscriptions.filter(sub => sub.id !== id))
    await deleteSubscriptionData(id)
    await updateBadge()
    return { deleted: true }
  },

  [Msg.markAlertsRead]: async () => {
    await markAllAlertsRead()
    await updateBadge()
    return { done: true }
  },

  [Msg.getIconImages]: async () => {
    const subscriptions = await getSubscriptions()
    const images: Record<string, string> = {}
    for (const subscription of subscriptions) {
      if (subscription.icon.kind !== 'image') continue
      const image = await getIconImage(subscription.id)
      if (image) images[subscription.id] = image
    }
    return images
  },

  [Msg.setIconImage]: async (payload) => {
    const id = String(payload.id ?? '')
    const dataUrl = String(payload.dataUrl ?? '')
    if (!id || !dataUrl.startsWith('data:image/')) throw new Error(t('errInvalidImage'))
    // Cap stored icon size (storage friendliness).
    if (dataUrl.length > 300_000) throw new Error(t('errImageTooLarge'))
    await setIconImage(id, dataUrl)
    return { done: true }
  },
}

function clampRange(value: unknown): number {
  const num = Number(value)
  if (!Number.isFinite(num)) return 30
  return Math.min(365, Math.max(7, Math.round(num)))
}

chrome.runtime.onMessage.addListener((message: ExtensionRequest, _sender, sendResponse) => {
  const handler = handlers[message?.type]
  if (!handler) return false

  handler(message.payload ?? {})
    .then(data => sendResponse({ ok: true, data } satisfies ExtensionResponse))
    .catch(error => sendResponse({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    } satisfies ExtensionResponse))

  return true
})

/**
 * Typed message contract between the UI pages and the background worker.
 */
import type {
  AlertRecord,
  SeriesPoint,
  SourceId,
  SourceStateMeta,
  Subscription,
} from '../core/types'
import { t } from './i18n'

export const Msg = Object.freeze({
  getOverview: 'GET_OVERVIEW',
  refreshNow: 'REFRESH_NOW',
  listSubscriptions: 'LIST_SUBSCRIPTIONS',
  saveSubscription: 'SAVE_SUBSCRIPTION',
  deleteSubscription: 'DELETE_SUBSCRIPTION',
  markAlertsRead: 'MARK_ALERTS_READ',
  setIconImage: 'SET_ICON_IMAGE',
  getIconImages: 'GET_ICON_IMAGES',
} as const)

export type MsgType = typeof Msg[keyof typeof Msg]

export interface SourceView {
  meta: SourceStateMeta
  /** keyword → points, already clipped to the requested range. */
  series: Record<string, SeriesPoint[]>
  /** Dates of alert contributions (chart dot markers). */
  alertDates: string[]
  /** True while the series is still in the learning stage. */
  learning: boolean
}

export interface SubscriptionView {
  subscription: Subscription
  iconImage: string | null
  latestAlert: AlertRecord | null
  sources: Partial<Record<SourceId, SourceView>>
}

export interface OverviewPayload {
  lastCheckAt: number | null
  unreadCount: number
  checking: boolean
  /** Live probe: false when the Baidu session cookie is absent. */
  baiduLoggedIn: boolean
  subscriptions: SubscriptionView[]
}

export interface ExtensionRequest {
  type: MsgType
  payload?: Record<string, unknown>
}

export interface ExtensionResponse<T = unknown> {
  ok: boolean
  data?: T
  error?: string
}

export function sendMessage<T>(type: MsgType, payload: Record<string, unknown> = {}): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type, payload } satisfies ExtensionRequest, (response: ExtensionResponse<T>) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message))
        return
      }
      if (!response?.ok) {
        reject(new Error(response?.error || t('requestFailed')))
        return
      }
      resolve(response.data as T)
    })
  })
}

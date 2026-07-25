/**
 * Toolbar badge = number of unread alerts. The toolbar icon itself never
 * changes (always the product brand icon).
 */
import { unreadAlertCount } from '../store/repo'

const BADGE_COLOR = '#ff9f0a' // amber: rising-attention colour, never red

export async function updateBadge(): Promise<void> {
  const count = await unreadAlertCount()
  await chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR })
  if (chrome.action.setBadgeTextColor) {
    await chrome.action.setBadgeTextColor({ color: '#ffffff' })
  }
  await chrome.action.setBadgeText({ text: count > 0 ? String(Math.min(count, 99)) : '' })
}

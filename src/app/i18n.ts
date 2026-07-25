/**
 * Thin chrome.i18n wrapper with a zh_CN fallback for Node / unit tests.
 */
import fallbackCatalog from '../../public/_locales/zh_CN/messages.json'

type MessageEntry = { message: string }

function format(template: string, substitutions?: string | string[]): string {
  const subs = substitutions == null
    ? []
    : Array.isArray(substitutions) ? substitutions : [substitutions]
  return template.replace(/\$(\d+)\$/g, (_match, index: string) => subs[Number(index) - 1] ?? '')
}

/** Localized UI string. Falls back to zh_CN catalog, then the key itself. */
export function t(key: string, substitutions?: string | string[]): string {
  try {
    if (typeof chrome !== 'undefined' && chrome.i18n?.getMessage) {
      const msg = chrome.i18n.getMessage(key, substitutions)
      if (msg) return msg
    }
  } catch {
    // Outside an extension context (unit tests, scripts).
  }
  const entry = (fallbackCatalog as Record<string, MessageEntry>)[key]
  if (entry?.message) return format(entry.message, substitutions)
  return key
}

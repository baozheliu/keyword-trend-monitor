/**
 * Subscription model helpers: validation, normalisation, defaults.
 */
import { t } from '../app/i18n'
import { DEFAULT_SENSITIVITY, DEFAULT_TEMPLATE, LIMITS, TEMPLATE_IDS } from './constants'
import type { CustomRuleConfig, Sensitivity, Subscription, SubscriptionIcon, TemplateId } from './types'

const SENSITIVITIES: readonly Sensitivity[] = ['high', 'standard', 'low']

export function createSubscriptionId(): string {
  return `sub-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/** First visible character of the name (handles surrogate pairs). */
export function nameInitial(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return t('letterFallback')
  return [...trimmed][0]!
}

export function defaultIconFor(name: string): SubscriptionIcon {
  return { kind: 'letter', value: nameInitial(name) }
}

export function sanitizeKeywords(keywords: readonly string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const raw of keywords) {
    const keyword = String(raw ?? '').trim()
    if (!keyword || seen.has(keyword)) continue
    seen.add(keyword)
    result.push(keyword)
    if (result.length >= LIMITS.maxKeywordsPerSubscription) break
  }
  return result
}

function normalizeCustom(custom: unknown): CustomRuleConfig | null {
  if (!custom || typeof custom !== 'object') return null
  const cfg = custom as Partial<CustomRuleConfig>
  return {
    direction: cfg.direction === 'down' ? 'down' : 'up',
    windowDays: clampInt(cfg.windowDays, 3, 14, 7),
    minChangePct: clampInt(cfg.minChangePct, 5, 500, 25),
    minStreakDays: clampInt(cfg.minStreakDays, 1, 7, 3),
  }
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const num = Number(value)
  if (!Number.isFinite(num)) return fallback
  return Math.min(max, Math.max(min, Math.round(num)))
}

export function normalizeSubscription(input: Partial<Subscription>): Subscription {
  const keywordsForName = sanitizeKeywords(input.keywords ?? [])
  // Name is optional in the UI: default to the first keyword.
  const name = String(input.name ?? '').trim().slice(0, 30)
    || keywordsForName[0]
    || t('unnamedSubscription')
  const template: TemplateId = TEMPLATE_IDS.includes(input.template as TemplateId)
    ? input.template as TemplateId
    : DEFAULT_TEMPLATE

  const icon = input.icon && ['letter', 'emoji', 'image'].includes(input.icon.kind) && input.icon.value
    ? input.icon
    : defaultIconFor(name)

  return {
    id: input.id || createSubscriptionId(),
    name,
    keywords: sanitizeKeywords(input.keywords ?? []),
    sources: {
      baidu: {
        enabled: input.sources?.baidu?.enabled ?? true,
        area: String(input.sources?.baidu?.area ?? ''),
      },
      google: {
        enabled: input.sources?.google?.enabled ?? true,
        area: String(input.sources?.google?.area ?? ''),
      },
    },
    template,
    sensitivity: SENSITIVITIES.includes(input.sensitivity as Sensitivity)
      ? input.sensitivity as Sensitivity
      : DEFAULT_SENSITIVITY,
    custom: template === 'custom' ? normalizeCustom(input.custom) ?? normalizeCustom({}) : null,
    icon,
    enabled: input.enabled ?? true,
    createdAt: input.createdAt ?? Date.now(),
  }
}

/** Returns a localized validation error, or null when the input is acceptable. */
export function validateSubscriptionInput(
  input: Partial<Subscription>,
  existingCount: number,
  isNew: boolean,
): string | null {
  if (isNew && existingCount >= LIMITS.maxSubscriptions) {
    return t('errMaxSubscriptions', String(LIMITS.maxSubscriptions))
  }
  const keywords = sanitizeKeywords(input.keywords ?? [])
  if (keywords.length === 0) {
    return t('errNeedKeyword')
  }
  if ((input.keywords?.length ?? 0) > LIMITS.maxKeywordsPerSubscription) {
    return t('errMaxKeywords', String(LIMITS.maxKeywordsPerSubscription))
  }
  if (!input.sources?.baidu?.enabled && !input.sources?.google?.enabled) {
    return t('errNeedSource')
  }
  return null
}

/** The removable default subscription created on first install. */
export function createDefaultSubscription(): Subscription {
  return normalizeSubscription({
    name: t('defaultSubName'),
    keywords: ['新冠', '新冠病毒', '新冠肺炎', 'COVID-19', 'coronavirus'],
    sources: {
      baidu: { enabled: true, area: '' },
      google: { enabled: true, area: '' },
    },
    template: 'smart',
    sensitivity: 'standard',
    icon: { kind: 'emoji', value: '🦠' },
    enabled: true,
  })
}

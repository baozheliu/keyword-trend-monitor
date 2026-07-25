<script setup>
import { computed, onMounted, ref } from 'vue'
import { t } from '../../app/i18n'
import { Msg, sendMessage } from '../../app/messages'
import LensFilter from '../../components/LensFilter.vue'
import GlassPanel from '../../components/GlassPanel.vue'
import SubIcon from '../../components/SubIcon.vue'
import TrendChart from '../../components/TrendChart.vue'

const overview = ref(null)
const loading = ref(true)
const refreshing = ref(false)
const error = ref('')
const expandedId = ref(null)
const rangeById = ref({})

const RANGES = computed(() => [
  { days: 7, label: t('range7d') },
  { days: 30, label: t('range30d') },
  { days: 90, label: t('range90d') },
  { days: 365, label: t('range1y') },
])

/** A recent alert is surfaced on the card for this long. */
const ALERT_VISIBLE_MS = 7 * 24 * 60 * 60 * 1000

/** Baidu passport login that returns to Baidu Index afterwards. */
const BAIDU_LOGIN_URL = 'https://passport.baidu.com/v2/?login&u='
  + encodeURIComponent('https://index.baidu.com/v2/index.html')

/**
 * The login banner shows whenever Baidu Index is in use but the user is not
 * logged in (live cookie probe), or a check already failed for auth reasons.
 */
const baiduNeedsLogin = computed(() => {
  const data = overview.value
  if (!data) return false
  const baiduInUse = data.subscriptions.some(view => view.sources.baidu)
  if (!baiduInUse) return false
  if (data.baiduLoggedIn === false) return true
  return data.subscriptions.some(view =>
    view.sources.baidu?.meta.status === 'failed'
    && view.sources.baidu.meta.reason === 'auth',
  )
})

function openBaiduLogin() {
  chrome.tabs.create({ url: BAIDU_LOGIN_URL })
}

async function load() {
  try {
    // Full year of stored history in one payload; ranges clip client-side.
    overview.value = await sendMessage(Msg.getOverview, { rangeDays: 365 })
    error.value = ''
  } catch (err) {
    error.value = err.message || String(err)
  } finally {
    loading.value = false
  }
}

async function refresh() {
  if (refreshing.value) return
  refreshing.value = true
  try {
    await sendMessage(Msg.refreshNow)
    await load()
  } catch (err) {
    error.value = err.message || String(err)
  } finally {
    refreshing.value = false
  }
}

function openOptions() {
  chrome.runtime.openOptionsPage()
}

function toggleExpand(id) {
  expandedId.value = expandedId.value === id ? null : id
}

function rangeFor(id) {
  return rangeById.value[id] ?? 30
}

function setRange(id, days) {
  rangeById.value = { ...rangeById.value, [id]: days }
}

function alertLine(view) {
  const alert = view.latestAlert
  if (alert && Date.now() - alert.createdAt < ALERT_VISIBLE_MS) {
    // The card already shows the subscription name; drop the "title：" / "title: "
    // prefix from the stored message so the line reads cleanly next to the title.
    const name = view.subscription.name
    const prefixes = [`${name}：`, `${name}: `, `${name}:`]
    let text = alert.message
    for (const prefix of prefixes) {
      if (text.startsWith(prefix)) {
        text = text.slice(prefix.length)
        break
      }
    }
    return { text, active: true, direction: alert.direction, at: alert.createdAt }
  }
  return { text: t('noAlert'), active: false, direction: null, at: null }
}

/** Coarse relative time for the alert. */
function relativeTime(ms) {
  const diff = Date.now() - ms
  const hours = Math.floor(diff / 3_600_000)
  if (hours < 1) return t('justNow')
  if (hours < 24) return t('hoursAgo', String(hours))
  return t('daysAgo', String(Math.floor(hours / 24)))
}

const lastCheckText = computed(() => {
  const at = overview.value?.lastCheckAt
  if (!at) return t('neverChecked')
  const date = new Date(at)
  const today = new Date()
  const sameDay = date.toDateString() === today.toDateString()
  const hm = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  return sameDay
    ? t('lastCheckToday', hm)
    : t('lastCheckDate', `${date.getMonth() + 1}/${date.getDate()} ${hm}`)
})

onMounted(async () => {
  await load()
  // The user has now seen the alert count; clear the badge.
  if (overview.value?.unreadCount > 0) {
    sendMessage(Msg.markAlertsRead).catch(() => {})
  }
})
</script>

<template>
  <main class="popup">
    <LensFilter />

    <header class="popup-header">
      <div class="brand">
        <svg class="brand-mark" viewBox="0 0 24 24" aria-hidden="true">
          <defs>
            <linearGradient id="brand-g" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#0a84ff" />
              <stop offset="100%" stop-color="#bf5af2" />
            </linearGradient>
          </defs>
          <path
            d="M3 15.5 8 9l4 4.5 4.5-7L21 12"
            fill="none" stroke="url(#brand-g)" stroke-width="2.4"
            stroke-linecap="round" stroke-linejoin="round"
          />
          <circle cx="21" cy="12" r="2.2" fill="#bf5af2" />
        </svg>
        <h1 class="title-glass">Keyword Watch</h1>
        <span v-if="overview?.unreadCount" class="unread-pill">{{ overview.unreadCount }}</span>
      </div>

      <div class="header-side">
        <span class="last-check">{{ lastCheckText }}</span>
        <button
          class="btn btn-icon"
          type="button"
          :disabled="refreshing"
          :title="t('refreshManual')"
          :aria-label="t('refreshManual')"
          @click="refresh"
        >
          <svg viewBox="0 0 24 24" width="15" height="15" :class="{ spinning: refreshing }" aria-hidden="true">
            <path
              d="M20 12a8 8 0 1 1-2.34-5.66M20 4v4h-4"
              fill="none" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round"
            />
          </svg>
        </button>
        <button class="btn btn-icon" type="button" :title="t('manageSubscriptions')" :aria-label="t('manageSubscriptions')" @click="openOptions">
          <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
            <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2" />
            <path
              d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.09a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.09a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1Z"
              fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
            />
          </svg>
        </button>
      </div>
    </header>

    <div v-if="loading" class="state-line">{{ t('loading') }}</div>
    <div v-else-if="error" class="state-line failed">{{ error }}</div>

    <template v-else-if="overview">
      <GlassPanel v-if="baiduNeedsLogin" card class="login-banner">
        <div class="login-banner-body">
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="2" />
            <path d="M4 20c1.8-3.4 4.6-5 8-5s6.2 1.6 8 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
          <p>{{ t('baiduLoginBanner') }}</p>
          <button class="btn btn-primary btn-sm" type="button" @click="openBaiduLogin">{{ t('goLogin') }}</button>
        </div>
      </GlassPanel>

      <GlassPanel v-if="overview.subscriptions.length === 0" card class="empty-panel">
        <div class="empty">
          <p class="title-glass">{{ t('emptyTitle') }}</p>
          <p class="empty-sub">{{ t('emptySub') }}</p>
          <button class="btn btn-primary" type="button" @click="openOptions">{{ t('createSubscription') }}</button>
        </div>
      </GlassPanel>

      <div class="cards">
        <GlassPanel
          v-for="(view, index) in overview.subscriptions"
          :key="view.subscription.id"
          card
          interactive
          :class="['sub-card', index % 3 === 1 ? 'sheen-late' : index % 3 === 2 ? 'sheen-later' : '']"
        >
          <button class="card-body" type="button" @click="toggleExpand(view.subscription.id)">
            <div class="card-head">
              <SubIcon :icon="view.subscription.icon" :image="view.iconImage" :size="38" />
              <div class="card-title">
                <h2 class="title-glass">{{ view.subscription.name }}</h2>
                <p
                  class="alert-line"
                  :class="{
                    quiet: !alertLine(view).active,
                    rise: alertLine(view).direction === 'up',
                    fall: alertLine(view).direction === 'down',
                  }"
                >
                  <svg
                    v-if="alertLine(view).active"
                    class="alert-icon"
                    viewBox="0 0 24 24" width="11" height="11" aria-hidden="true"
                  >
                    <path
                      :d="alertLine(view).direction === 'down' ? 'M4 7l6 7 4-4 6 7' : 'M4 17l6-7 4 4 6-7'"
                      fill="none" stroke="currentColor" stroke-width="2.5"
                      stroke-linecap="round" stroke-linejoin="round"
                    />
                  </svg>
                  <span class="alert-text">{{ alertLine(view).text }}</span>
                  <time v-if="alertLine(view).at" class="alert-time">{{ relativeTime(alertLine(view).at) }}</time>
                </p>
              </div>
              <svg
                class="chevron" :class="{ open: expandedId === view.subscription.id }"
                viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"
              >
                <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </div>

            <div v-if="expandedId === view.subscription.id" class="range-row" @click.stop>
              <div class="segmented">
                <button
                  v-for="range in RANGES"
                  :key="range.days"
                  type="button"
                  :class="{ active: rangeFor(view.subscription.id) === range.days }"
                  @click="setRange(view.subscription.id, range.days)"
                >
                  {{ range.label }}
                </button>
              </div>
            </div>

            <div class="charts">
              <TrendChart
                v-if="view.sources.baidu"
                :label="t('sourceBaidu')"
                :series="view.sources.baidu.series"
                :alert-dates="view.sources.baidu.alertDates"
                :range-days="expandedId === view.subscription.id ? rangeFor(view.subscription.id) : 30"
                :meta="view.sources.baidu.meta"
                :learning="view.sources.baidu.learning"
                accent="#0a84ff"
                :fail-text="t('baiduFetchFailedShort')"
                :login-url="BAIDU_LOGIN_URL"
                :login-likely="overview.baiduLoggedIn === false"
              />
              <TrendChart
                v-if="view.sources.google"
                :label="t('sourceGoogle')"
                :series="view.sources.google.series"
                :alert-dates="view.sources.google.alertDates"
                :range-days="expandedId === view.subscription.id ? rangeFor(view.subscription.id) : 30"
                :meta="view.sources.google.meta"
                :learning="view.sources.google.learning"
                accent="#bf5af2"
                :fail-text="t('googleFetchFailedShort')"
              />
              <p v-if="!view.sources.baidu && !view.sources.google" class="state-line">{{ t('noSourceEnabled') }}</p>
            </div>
          </button>
        </GlassPanel>
      </div>
    </template>
  </main>
</template>

<style scoped>
.popup {
  position: relative;
  width: 384px;
  max-height: 584px;
  overflow-y: auto;
  padding: 14px 14px 16px;
  display: grid;
  gap: 12px;
  align-content: start;
}

.popup-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 2px 4px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.brand-mark { width: 22px; height: 22px; flex: none; }

.brand h1 { font-size: 15px; white-space: nowrap; }

.unread-pill {
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  display: inline-grid;
  place-items: center;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  background: var(--accent-amber);
  box-shadow: 0 2px 6px -2px rgba(255, 159, 10, 0.8);
}

.header-side {
  display: flex;
  align-items: center;
  gap: 6px;
}

.last-check {
  font-size: 11px;
  color: var(--text-secondary);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.spinning { animation: kw-spin 0.9s linear infinite; }
@keyframes kw-spin { to { transform: rotate(360deg); } }

.state-line {
  padding: 20px 8px;
  text-align: center;
  font-size: 12px;
  color: var(--text-secondary);
}
.state-line.failed { color: var(--accent-fail); }

.cards { display: grid; gap: 12px; }

.login-banner-body {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  color: var(--text-secondary);
}
.login-banner-body p {
  flex: 1;
  font-size: 11.5px;
  line-height: 1.45;
}
.login-banner-body svg { flex: none; color: var(--accent-rise); }

.card-body {
  display: grid;
  gap: 10px;
  width: 100%;
  padding: 14px;
  text-align: left;
  color: inherit;
}

.card-head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.card-title { min-width: 0; flex: 1; display: grid; gap: 2px; }
.card-title h2 {
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.alert-line {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  max-width: 100%;
  justify-self: start;
  font-size: 11px;
  font-weight: 600;
  color: var(--accent-rise);
  padding: 2px 9px;
  margin-left: -9px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent-rise) 12%, transparent);
}
.alert-icon { flex: none; }
.alert-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.alert-time {
  flex: none;
  font-weight: 500;
  opacity: 0.7;
  font-variant-numeric: tabular-nums;
}
.alert-line.quiet {
  color: var(--text-tertiary);
  font-weight: 500;
  background: none;
  padding: 0;
  margin-left: 0;
}
.alert-line.fall {
  color: var(--accent-amber);
  background: color-mix(in srgb, var(--accent-amber) 14%, transparent);
}

.chevron {
  color: var(--text-tertiary);
  flex: none;
  transition: transform 0.25s cubic-bezier(0.3, 1.3, 0.5, 1);
}
.chevron.open { transform: rotate(90deg); }

.range-row { display: flex; justify-content: center; }

.charts { display: grid; gap: 10px; }
.charts > * + * {
  border-top: 1px solid color-mix(in srgb, var(--text) 8%, transparent);
  padding-top: 10px;
}

.empty-panel .empty {
  display: grid;
  gap: 10px;
  justify-items: center;
  padding: 26px 16px;
  text-align: center;
}
.empty-sub { font-size: 12px; color: var(--text-secondary); }

@media (prefers-reduced-motion: reduce) {
  .spinning { animation: none; }
}
</style>

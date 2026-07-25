<script setup>
/**
 * One source's trend chart: SVG multi-line (one smooth curve per keyword),
 * gaps for missing days, amber dots on alert dates, an emphasized dot on the
 * freshest value. Each chart owns its y-axis — Baidu and Google values are
 * never compared or merged.
 */
import { computed } from 'vue'
import { t } from '../app/i18n'

const props = defineProps({
  label: { type: String, required: true },
  /** keyword → [{date, value}] */
  series: { type: Object, required: true },
  alertDates: { type: Array, default: () => [] },
  rangeDays: { type: Number, default: 30 },
  meta: { type: Object, required: true },
  learning: { type: Boolean, default: false },
  accent: { type: String, default: '#0a84ff' },
  failText: { type: String, required: true },
  /** Shown as a shortcut when the failure is a login problem. */
  loginUrl: { type: String, default: '' },
  /** Live login probe from the caller (e.g. Baidu session cookie absent). */
  loginLikely: { type: Boolean, default: false },
})

const WIDTH = 316
const HEIGHT = 64
const PAD_Y = 7

/** Gradient ids must be URL-safe and unique per chart instance. */
const uid = Math.random().toString(36).slice(2, 9)
const gradientId = `kw-fill-${uid}`
const strokeId = `kw-stroke-${uid}`
const glowId = `kw-glow-${uid}`

/** Catmull-Rom → cubic Bézier, so daily data reads as a soft ribbon. */
function smoothPath(points) {
  if (points.length < 2) return ''
  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] ?? points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] ?? p2
    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
  }
  return d
}

function areaPath(points) {
  const line = smoothPath(points)
  if (!line) return ''
  const first = points[0]
  const last = points[points.length - 1]
  return `${line} L ${last.x.toFixed(1)} ${HEIGHT} L ${first.x.toFixed(1)} ${HEIGHT} Z`
}

const model = computed(() => {
  const keywords = Object.keys(props.series)
  const dates = new Set()
  for (const keyword of keywords) {
    for (const point of clip(props.series[keyword])) dates.add(point.date)
  }
  const axis = [...dates].sort()
  if (axis.length === 0) return { axis: [], lines: [], dots: [], endDot: null }

  const xOf = (date) => {
    if (axis.length === 1) return WIDTH / 2
    return (axis.indexOf(date) / (axis.length - 1)) * WIDTH
  }

  let min = Infinity
  let max = -Infinity
  const byKeyword = new Map()
  for (const keyword of keywords) {
    const map = new Map()
    for (const point of clip(props.series[keyword])) {
      map.set(point.date, point.value)
      if (point.value !== null) {
        min = Math.min(min, point.value)
        max = Math.max(max, point.value)
      }
    }
    byKeyword.set(keyword, map)
  }
  if (!Number.isFinite(min)) return { axis, lines: [], dots: [], endDot: null }
  if (min === max) { min -= 1; max += 1 }

  const yOf = (value) => HEIGHT - PAD_Y - ((value - min) / (max - min)) * (HEIGHT - PAD_Y * 2)

  const lines = []
  keywords.forEach((keyword, index) => {
    const map = byKeyword.get(keyword)
    const segments = []
    let current = []
    for (const date of axis) {
      const value = map.has(date) ? map.get(date) : null
      if (value === null || value === undefined) {
        if (current.length > 1) segments.push(current)
        current = []
      } else {
        current.push({ x: xOf(date), y: yOf(value) })
      }
    }
    if (current.length > 1) segments.push(current)
    lines.push({
      keyword,
      primary: index === 0,
      segments: segments.map(seg => ({ path: smoothPath(seg), area: areaPath(seg) })),
    })
  })

  // Emphasized dot on the freshest value of the primary keyword.
  let endDot = null
  const primaryMap = byKeyword.get(keywords[0])
  for (let i = axis.length - 1; i >= 0; i -= 1) {
    const value = primaryMap?.get(axis[i])
    if (value !== null && value !== undefined) {
      endDot = { x: xOf(axis[i]), y: yOf(value) }
      break
    }
  }

  // Alert dots: rendered on the first keyword that has data for the date.
  const dots = []
  for (const date of props.alertDates) {
    if (!dates.has(date)) continue
    for (const keyword of keywords) {
      const value = byKeyword.get(keyword)?.get(date)
      if (value !== null && value !== undefined) {
        dots.push({ x: xOf(date), y: yOf(value) })
        break
      }
    }
  }

  return { axis, lines, dots, endDot }
})

function clip(points) {
  if (!Array.isArray(points)) return []
  return points.slice(Math.max(0, points.length - props.rangeDays))
}

const hasData = computed(() => model.value.lines.some(line => line.segments.length > 0))

const statusText = computed(() => {
  if (props.meta.status === 'failed') return props.failText
  if (props.meta.status === 'pending') return t('waitingFirstData')
  if (props.meta.latestDataDate) return t('dataUntil', props.meta.latestDataDate.slice(5))
  return ''
})

const needsLogin = computed(() =>
  props.meta.status === 'failed'
  && !!props.loginUrl
  && (props.meta.reason === 'auth' || props.loginLikely),
)

/** What the user can do about a failure, phrased for non-experts. */
const failHint = computed(() => {
  if (needsLogin.value) return t('failHintLogin')
  switch (props.meta.reason) {
    case 'auth': return t('failHintLogin')
    case 'rate-limited': return t('failHintRateLimited')
    case 'parse': return t('failHintParse')
    default: return t('failHintNetwork')
  }
})

function openLogin() {
  chrome.tabs.create({ url: props.loginUrl })
}
</script>

<template>
  <div class="chart">
    <div class="chart-head">
      <span class="chart-label">
        <i class="chart-tick" :style="{ background: accent }" aria-hidden="true" />
        {{ label }}
      </span>
      <span class="chart-status" :class="{ failed: meta.status === 'failed' }">
        <svg v-if="meta.status === 'failed'" viewBox="0 0 24 24" width="10" height="10" aria-hidden="true">
          <path
            d="M12 3 2.5 20h19L12 3Zm0 6v5m0 3v.5"
            fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"
          />
        </svg>
        {{ statusText }}
      </span>
    </div>

    <svg
      v-if="hasData"
      class="chart-svg"
      :viewBox="`0 0 ${WIDTH} ${HEIGHT}`"
      preserveAspectRatio="none"
      role="img"
      :aria-label="t('chartAria', label)"
    >
      <defs>
        <linearGradient :id="gradientId" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" :stop-color="accent" stop-opacity="0.26" />
          <stop offset="100%" :stop-color="accent" stop-opacity="0" />
        </linearGradient>
        <linearGradient :id="strokeId" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" :stop-color="accent" stop-opacity="0.55" />
          <stop offset="100%" :stop-color="accent" stop-opacity="1" />
        </linearGradient>
        <filter :id="glowId" x="-10%" y="-40%" width="120%" height="180%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.4" :flood-color="accent" flood-opacity="0.35" />
        </filter>
      </defs>

      <line
        x1="0" :y1="HEIGHT - 0.5" :x2="WIDTH" :y2="HEIGHT - 0.5"
        :stroke="accent" stroke-opacity="0.18" stroke-width="1"
      />

      <template v-for="line in model.lines" :key="line.keyword">
        <template v-if="line.primary">
          <path
            v-for="(seg, i) in line.segments"
            :key="`area-${i}`"
            :d="seg.area"
            :fill="`url(#${gradientId})`"
          />
        </template>
        <path
          v-for="(seg, i) in line.segments"
          :key="`line-${i}`"
          :d="seg.path"
          fill="none"
          :stroke="line.primary ? `url(#${strokeId})` : accent"
          :stroke-opacity="line.primary ? 1 : 0.3"
          :stroke-width="line.primary ? 2 : 1.1"
          stroke-linejoin="round"
          stroke-linecap="round"
          :filter="line.primary ? `url(#${glowId})` : undefined"
        />
      </template>

      <template v-if="model.endDot">
        <circle class="end-halo" :cx="model.endDot.x" :cy="model.endDot.y" r="5" :fill="accent" fill-opacity="0.18" />
        <circle :cx="model.endDot.x" :cy="model.endDot.y" r="2.4" :fill="accent" stroke="#fff" stroke-width="1.2" />
      </template>

      <template v-for="(dot, i) in model.dots" :key="`dot-${i}`">
        <circle class="alert-halo" :cx="dot.x" :cy="dot.y" r="4.6" fill="#ff9f0a" fill-opacity="0.25" />
        <circle :cx="dot.x" :cy="dot.y" r="2.4" fill="#ff9f0a" stroke="#fff" stroke-width="1.1" />
      </template>
    </svg>

    <div v-else class="chart-empty">
      <span v-if="meta.status === 'failed'">{{ failHint }}</span>
      <span v-else>{{ learning ? t('learning') : t('noData') }}</span>
      <button v-if="needsLogin" class="login-link" type="button" @click="openLogin">{{ t('goLogin') }}</button>
    </div>

    <div v-if="hasData && meta.status === 'failed'" class="chart-footnote">
      <span>{{ failHint }}</span>
      <button v-if="needsLogin" class="login-link" type="button" @click="openLogin">{{ t('goLogin') }}</button>
    </div>
    <p v-if="hasData && learning" class="chart-learning">{{ t('learning') }}</p>
  </div>
</template>

<style scoped>
.chart { display: grid; gap: 5px; }

.chart-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.chart-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 650;
  letter-spacing: 0.4px;
  color: var(--text-secondary);
}

.chart-tick {
  width: 8px;
  height: 8px;
  border-radius: 3px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4);
}

.chart-status {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  color: var(--text-tertiary);
  font-variant-numeric: tabular-nums;
}

.chart-status.failed, .failed { color: var(--accent-fail); }

.chart-svg {
  width: 100%;
  height: 64px;
  display: block;
  overflow: visible;
}

.alert-halo {
  transform-box: fill-box;
  transform-origin: center;
  animation: kw-dot-pulse 2.4s ease-in-out infinite;
}
.end-halo {
  transform-box: fill-box;
  transform-origin: center;
  animation: kw-dot-pulse 3s ease-in-out infinite;
}
@keyframes kw-dot-pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.35); opacity: 0.55; }
}
@media (prefers-reduced-motion: reduce) {
  .alert-halo, .end-halo { animation: none; }
}

.chart-empty {
  min-height: 52px;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 5px;
  font-size: 11px;
  color: var(--text-tertiary);
  text-align: center;
  padding: 0 12px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--text) 4%, transparent);
}

.chart-learning {
  font-size: 10px;
  color: var(--text-tertiary);
}

.chart-footnote {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 10px;
  color: var(--text-tertiary);
}

.login-link {
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 650;
  color: var(--accent-rise);
  background: color-mix(in srgb, var(--accent-rise) 12%, transparent);
  transition: filter 0.2s ease, transform 0.2s ease;
}
.login-link:hover { filter: brightness(1.1); }
.login-link:active { transform: scale(0.94); }
</style>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { t } from '../../app/i18n'
import { Msg, sendMessage } from '../../app/messages'
import { baiduRegionOptions, googleRegionOptions } from '../../core/regions'
import LensFilter from '../../components/LensFilter.vue'
import GlassPanel from '../../components/GlassPanel.vue'
import SubIcon from '../../components/SubIcon.vue'

const MAX_SUBSCRIPTIONS = 5
const MAX_KEYWORDS = 5

const subscriptions = ref([])
const iconImages = ref({})
const editing = ref(null) // working copy of the subscription being edited
const isNew = ref(false)
const keywordInput = ref('')
const formError = ref('')
const saving = ref(false)
const savedFlash = ref(false)
const iconImagePreview = ref(null)
const pendingIconImage = ref(null)
const fileInput = ref(null)
const showAdvanced = ref(false)
const showIconPicker = ref(false)

// The default icon follows the name (or first keyword) automatically —
// no interaction needed unless the user explicitly picks an icon.
watch(
  () => [editing.value?.name, editing.value?.keywords?.length],
  () => {
    const sub = editing.value
    if (!sub || sub.icon.kind !== 'letter') return
    const base = sub.name.trim() || sub.keywords[0] || ''
    sub.icon = { kind: 'letter', value: base ? [...base][0] : t('letterFallback') }
  },
)

const TEMPLATES = computed(() => [
  { id: 'smart', name: t('templateSmart'), desc: t('templateSmartDesc'), curve: '0,26 10,24 20,27 30,23 40,25 50,18 60,12 70,7 80,4' },
  { id: 'rapidRise', name: t('templateRapidRise'), desc: t('templateRapidRiseDesc'), curve: '0,27 15,26 30,27 45,26 55,25 65,10 80,3' },
  { id: 'sustainedRise', name: t('templateSustainedRise'), desc: t('templateSustainedRiseDesc'), curve: '0,30 12,27 24,24 36,20 48,16 60,12 72,8 80,5' },
  { id: 'trendReversal', name: t('templateTrendReversal'), desc: t('templateTrendReversalDesc'), curve: '0,12 14,16 28,21 42,25 52,26 62,20 72,12 80,5' },
  { id: 'abnormalDrop', name: t('templateAbnormalDrop'), desc: t('templateAbnormalDropDesc'), curve: '0,8 15,9 30,8 45,9 55,10 65,24 80,30' },
  { id: 'volatility', name: t('templateVolatility'), desc: t('templateVolatilityDesc'), curve: '0,18 8,16 16,19 24,17 32,18 40,6 48,30 56,4 64,28 72,8 80,24' },
  { id: 'custom', name: t('templateCustom'), desc: t('templateCustomDesc'), curve: '0,24 20,20 40,16 60,12 80,8', dashed: true },
])

const SENSITIVITIES = computed(() => [
  { id: 'high', label: t('sensitivityHigh') },
  { id: 'standard', label: t('sensitivityStandard') },
  { id: 'low', label: t('sensitivityLow') },
])

const EMOJIS = ['🔍', '📈', '🔥', '🌡️', '🦠', '💊', '🏥', '🌏', '⚡', '⭐', '💡', '📱', '🚗', '✈️', '🏠', '💰', '🛒', '🎮', '🎬', '🎓', '⚽', '🍜', '☕', '🌸']

const baiduRegions = computed(() => baiduRegionOptions())
const googleRegions = computed(() => googleRegionOptions())
const groupDefault = computed(() => t('groupDefault'))

const canCreate = computed(() => subscriptions.value.length < MAX_SUBSCRIPTIONS)

async function load() {
  subscriptions.value = await sendMessage(Msg.listSubscriptions)
  iconImages.value = await sendMessage(Msg.getIconImages)
}

function blankSubscription() {
  return {
    id: '',
    name: '',
    keywords: [],
    sources: {
      baidu: { enabled: true, area: '' },
      google: { enabled: true, area: '' },
    },
    template: 'smart',
    sensitivity: 'standard',
    custom: { direction: 'up', windowDays: 7, minChangePct: 25, minStreakDays: 3 },
    icon: { kind: 'letter', value: '' },
    enabled: true,
  }
}

function startCreate() {
  editing.value = blankSubscription()
  isNew.value = true
  formError.value = ''
  iconImagePreview.value = null
  pendingIconImage.value = null
  showAdvanced.value = false
  showIconPicker.value = false
}

function startEdit(subscription) {
  editing.value = JSON.parse(JSON.stringify({
    ...subscription,
    custom: subscription.custom ?? { direction: 'up', windowDays: 7, minChangePct: 25, minStreakDays: 3 },
  }))
  isNew.value = false
  formError.value = ''
  pendingIconImage.value = null
  iconImagePreview.value = subscription.icon.kind === 'image'
    ? (iconImages.value[subscription.id] ?? null)
    : null
  // Surface the advanced block only when it differs from the defaults.
  showAdvanced.value = Boolean(
    subscription.sources.baidu.area
    || subscription.sources.google.area
    || subscription.sensitivity !== 'standard',
  )
  showIconPicker.value = false
}

function cancelEdit() {
  editing.value = null
  formError.value = ''
}

/** Accepts one keyword or a whole pasted list (逗号/顿号/分号/空格分隔). */
function addKeyword() {
  if (!editing.value) return
  const parts = keywordInput.value
    .split(/[,，、;；\n\s]+/)
    .map(part => part.trim())
    .filter(Boolean)
  if (parts.length === 0) return

  for (const keyword of parts) {
    if (editing.value.keywords.includes(keyword)) continue
    if (editing.value.keywords.length >= MAX_KEYWORDS) {
      formError.value = t('errMaxKeywords', String(MAX_KEYWORDS))
      keywordInput.value = ''
      return
    }
    editing.value.keywords.push(keyword)
  }
  keywordInput.value = ''
  formError.value = ''
}

function removeKeyword(keyword) {
  editing.value.keywords = editing.value.keywords.filter(k => k !== keyword)
}

function chooseLetterIcon() {
  const base = editing.value.name.trim() || editing.value.keywords[0] || ''
  editing.value.icon = { kind: 'letter', value: base ? [...base][0] : t('letterFallback') }
  pendingIconImage.value = null
}

function chooseEmoji(emoji) {
  editing.value.icon = { kind: 'emoji', value: emoji }
  pendingIconImage.value = null
}

function pickImage() {
  fileInput.value?.click()
}

function onImagePicked(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file || !file.type.startsWith('image/')) return

  const reader = new FileReader()
  reader.onload = () => {
    const img = new Image()
    img.onload = () => {
      // Centre-crop into a 128×128 square; stored locally only.
      const side = Math.min(img.width, img.height)
      const canvas = document.createElement('canvas')
      canvas.width = 128
      canvas.height = 128
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 128, 128)
      const dataUrl = canvas.toDataURL('image/png')
      pendingIconImage.value = dataUrl
      iconImagePreview.value = dataUrl
      editing.value.icon = { kind: 'image', value: 'local' }
    }
    img.src = String(reader.result)
  }
  reader.readAsDataURL(file)
}

async function save() {
  if (!editing.value || saving.value) return
  // Typing a keyword and clicking 保存 directly should just work.
  addKeyword()
  saving.value = true
  formError.value = ''
  try {
    const payload = { ...editing.value }
    if (!payload.id) delete payload.id
    if (payload.template !== 'custom') payload.custom = null
    if (payload.icon.kind === 'letter' && !payload.icon.value) {
      const base = payload.name.trim() || payload.keywords[0] || t('letterFallback')
      payload.icon = { kind: 'letter', value: [...base][0] }
    }
    const saved = await sendMessage(Msg.saveSubscription, { subscription: payload })
    if (pendingIconImage.value) {
      await sendMessage(Msg.setIconImage, { id: saved.id, dataUrl: pendingIconImage.value })
    }
    await load()
    editing.value = null
    savedFlash.value = true
    setTimeout(() => { savedFlash.value = false }, 1600)
  } catch (err) {
    formError.value = err.message || String(err)
  } finally {
    saving.value = false
  }
}

async function toggleEnabled(subscription) {
  await sendMessage(Msg.saveSubscription, {
    subscription: { ...subscription, enabled: !subscription.enabled },
  })
  await load()
}

const confirmingDelete = ref('')

async function removeSubscription(subscription) {
  if (confirmingDelete.value !== subscription.id) {
    confirmingDelete.value = subscription.id
    setTimeout(() => { confirmingDelete.value = '' }, 3000)
    return
  }
  confirmingDelete.value = ''
  await sendMessage(Msg.deleteSubscription, { id: subscription.id })
  await load()
}

function sourceSummary(subscription) {
  const parts = []
  if (subscription.sources.baidu.enabled) parts.push(t('sourceBaidu'))
  if (subscription.sources.google.enabled) parts.push(t('sourceGoogle'))
  return parts.join(' · ') || t('sourceNone')
}

function templateName(id) {
  return TEMPLATES.value.find(item => item.id === id)?.name ?? id
}

function sensitivityLabel(id) {
  return SENSITIVITIES.value.find(item => item.id === id)?.label ?? id
}

function regionOptionLabel(region) {
  return region.group === groupDefault.value
    ? region.label
    : region.group === t('groupCountry')
      ? region.label
      : `${region.group} · ${region.label}`
}

function metaLine(subscription) {
  return t('metaLine', [
    sourceSummary(subscription),
    templateName(subscription.template),
    sensitivityLabel(subscription.sensitivity),
  ])
}

onMounted(load)
</script>

<template>
  <main class="options">
    <LensFilter />

    <header class="page-head">
      <div class="brand">
        <svg class="brand-mark" viewBox="0 0 24 24" aria-hidden="true">
          <defs>
            <linearGradient id="brand-g2" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#0a84ff" />
              <stop offset="100%" stop-color="#bf5af2" />
            </linearGradient>
          </defs>
          <path d="M3 15.5 8 9l4 4.5 4.5-7L21 12" fill="none" stroke="url(#brand-g2)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
          <circle cx="21" cy="12" r="2.2" fill="#bf5af2" />
        </svg>
        <h1 class="title-glass">{{ t('optionsTitle') }}</h1>
      </div>
      <span v-if="savedFlash" class="saved-flash check-pop">{{ t('saved') }}</span>
    </header>

    <!-- subscription list -->
    <GlassPanel v-if="!editing" class="panel">
      <div class="panel-inner">
        <div class="panel-head">
          <h2 class="title-glass">{{ t('mySubscriptions') }}</h2>
          <button class="btn btn-primary" type="button" :disabled="!canCreate" @click="startCreate">
            {{ t('newSubscription') }}
          </button>
        </div>
        <p v-if="!canCreate" class="hint">{{ t('atLimit', String(MAX_SUBSCRIPTIONS)) }}</p>

        <p v-if="subscriptions.length === 0" class="hint">
          {{ t('emptyListHint') }}
        </p>

        <ul class="sub-list">
          <li
            v-for="subscription in subscriptions"
            :key="subscription.id"
            class="sub-row"
            :class="{ disabled: !subscription.enabled }"
          >
            <SubIcon :icon="subscription.icon" :image="iconImages[subscription.id] ?? null" :size="40" />
            <div class="sub-info">
              <strong>{{ subscription.name }}</strong>
              <span class="sub-meta">{{ subscription.keywords.join(t('listSep')) }}</span>
              <span class="sub-meta">
                {{ metaLine(subscription) }}
              </span>
            </div>
            <div class="sub-actions">
              <button
                class="switch"
                :class="{ on: subscription.enabled }"
                type="button"
                role="switch"
                :aria-checked="subscription.enabled"
                :title="subscription.enabled ? t('disable') : t('enable')"
                @click="toggleEnabled(subscription)"
              />
              <button class="btn" type="button" @click="startEdit(subscription)">{{ t('edit') }}</button>
              <button class="btn btn-danger" type="button" @click="removeSubscription(subscription)">
                {{ confirmingDelete === subscription.id ? t('confirmDelete') : t('delete') }}
              </button>
            </div>
          </li>
        </ul>
      </div>
    </GlassPanel>

    <!-- editor -->
    <GlassPanel v-else class="panel">
      <div class="panel-inner editor">
        <div class="panel-head">
          <h2 class="title-glass">{{ isNew ? t('newSubscription') : t('editSubscription') }}</h2>
          <div class="head-actions">
            <button class="btn" type="button" @click="cancelEdit">{{ t('cancel') }}</button>
            <button class="btn btn-primary" type="button" :disabled="saving" @click="save">
              {{ saving ? t('saving') : t('save') }}
            </button>
          </div>
        </div>

        <p v-if="formError" class="form-error">{{ formError }}</p>

        <!-- keywords: the only required input -->
        <section class="block">
          <label class="block-label" for="kw-input">{{ t('keywordsLabel', String(MAX_KEYWORDS)) }}</label>
          <div v-if="editing.keywords.length" class="chips">
            <span v-for="keyword in editing.keywords" :key="keyword" class="chip">
              {{ keyword }}
              <button type="button" class="chip-x" :aria-label="t('removeKeyword', keyword)" @click="removeKeyword(keyword)">
                <svg viewBox="0 0 24 24" width="10" height="10" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
                </svg>
              </button>
            </span>
          </div>
          <div class="kw-input-row">
            <input
              id="kw-input"
              v-model="keywordInput"
              class="field-input"
              :placeholder="t('keywordsPlaceholder')"
              @keydown.enter.prevent="addKeyword"
              @blur="addKeyword"
            />
            <button class="btn" type="button" @click="addKeyword">{{ t('add') }}</button>
          </div>
          <p class="hint">{{ t('keywordsHint') }}</p>
        </section>

        <!-- name + icon (optional) -->
        <section class="block">
          <label class="block-label" for="sub-name">{{ t('nameIconLabel') }}</label>
          <div class="name-row">
            <button class="icon-btn" type="button" :title="t('clickChangeIcon')" :aria-label="t('changeIcon')" @click="showIconPicker = !showIconPicker">
              <SubIcon :icon="editing.icon" :image="iconImagePreview" :size="44" />
              <span class="icon-btn-edit" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="9" height="9">
                  <path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </span>
            </button>
            <input
              id="sub-name"
              v-model="editing.name"
              class="field-input"
              maxlength="30"
              :placeholder="t('namePlaceholder')"
            />
          </div>
          <div v-if="showIconPicker" class="icon-picker">
            <div class="icon-row">
              <button class="btn" type="button" @click="chooseLetterIcon">{{ t('useInitial') }}</button>
              <button class="btn" type="button" @click="pickImage">{{ t('uploadSquare') }}</button>
              <input ref="fileInput" type="file" accept="image/*" hidden @change="onImagePicked" />
            </div>
            <div class="emoji-grid">
              <button
                v-for="emoji in EMOJIS"
                :key="emoji"
                type="button"
                class="emoji-cell"
                :class="{ active: editing.icon.kind === 'emoji' && editing.icon.value === emoji }"
                @click="chooseEmoji(emoji)"
              >
                {{ emoji }}
              </button>
            </div>
          </div>
        </section>

        <!-- sources: plain switches, regions live under more options -->
        <section class="block">
          <span class="block-label">{{ t('dataSources') }}</span>
          <div class="source-row">
            <div class="source-name">
              <button
                class="switch"
                :class="{ on: editing.sources.baidu.enabled }"
                type="button"
                role="switch"
                :aria-checked="editing.sources.baidu.enabled"
                @click="editing.sources.baidu.enabled = !editing.sources.baidu.enabled"
              />
              <span>{{ t('sourceBaidu') }}</span>
            </div>
            <span class="source-note">{{ t('baiduNeedsLogin') }}</span>
          </div>
          <div class="source-row">
            <div class="source-name">
              <button
                class="switch"
                :class="{ on: editing.sources.google.enabled }"
                type="button"
                role="switch"
                :aria-checked="editing.sources.google.enabled"
                @click="editing.sources.google.enabled = !editing.sources.google.enabled"
              />
              <span>{{ t('sourceGoogle') }}</span>
            </div>
            <span class="source-note">{{ t('googleNoLogin') }}</span>
          </div>
        </section>

        <!-- template -->
        <section class="block">
          <span class="block-label">{{ t('alertTemplate') }}</span>
          <div class="template-grid">
            <button
              v-for="template in TEMPLATES"
              :key="template.id"
              type="button"
              class="template-card"
              :class="{ active: editing.template === template.id }"
              @click="editing.template = template.id"
            >
              <svg viewBox="0 0 80 34" class="template-curve" aria-hidden="true">
                <polyline
                  :points="template.curve"
                  fill="none"
                  stroke="url(#brand-g2)"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  :stroke-dasharray="template.dashed ? '4 3' : undefined"
                />
              </svg>
              <strong>{{ template.name }}</strong>
              <span>{{ template.desc }}</span>
              <svg v-if="editing.template === template.id" class="template-check check-pop" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <circle cx="12" cy="12" r="11" fill="#0a84ff" />
                <path d="M7 12.5l3.2 3L17 9" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
          </div>

          <div v-if="editing.template === 'custom'" class="custom-config">
            <div class="custom-row">
              <span>{{ t('direction') }}</span>
              <div class="segmented">
                <button type="button" :class="{ active: editing.custom.direction === 'up' }" @click="editing.custom.direction = 'up'">{{ t('directionUp') }}</button>
                <button type="button" :class="{ active: editing.custom.direction === 'down' }" @click="editing.custom.direction = 'down'">{{ t('directionDown') }}</button>
              </div>
            </div>
            <div class="custom-row">
              <span>{{ t('windowDays') }}</span>
              <div class="stepper">
                <button type="button" @click="editing.custom.windowDays = Math.max(3, editing.custom.windowDays - 1)">−</button>
                <span class="stepper-value">{{ editing.custom.windowDays }}</span>
                <button type="button" @click="editing.custom.windowDays = Math.min(14, editing.custom.windowDays + 1)">＋</button>
              </div>
            </div>
            <div class="custom-row">
              <span>{{ t('minChangePct') }}</span>
              <div class="stepper">
                <button type="button" @click="editing.custom.minChangePct = Math.max(5, editing.custom.minChangePct - 5)">−</button>
                <span class="stepper-value">{{ editing.custom.minChangePct }}</span>
                <button type="button" @click="editing.custom.minChangePct = Math.min(500, editing.custom.minChangePct + 5)">＋</button>
              </div>
            </div>
            <div class="custom-row">
              <span>{{ t('streakDays') }}</span>
              <div class="stepper">
                <button type="button" @click="editing.custom.minStreakDays = Math.max(1, editing.custom.minStreakDays - 1)">−</button>
                <span class="stepper-value">{{ editing.custom.minStreakDays }}</span>
                <button type="button" @click="editing.custom.minStreakDays = Math.min(7, editing.custom.minStreakDays + 1)">＋</button>
              </div>
            </div>
          </div>
        </section>

        <!-- advanced: region + sensitivity, collapsed by default -->
        <section class="block">
          <button class="advanced-toggle" type="button" @click="showAdvanced = !showAdvanced">
            <svg class="advanced-chevron" :class="{ open: showAdvanced }" viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
              <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            {{ t('moreOptions') }}
          </button>

          <div v-if="showAdvanced" class="advanced-body">
            <div class="advanced-row">
              <span>{{ t('baiduRegion') }}</span>
              <select v-model="editing.sources.baidu.area" class="field-input region-select" :disabled="!editing.sources.baidu.enabled">
                <option v-for="region in baiduRegions" :key="region.code || 'default'" :value="region.code">
                  {{ regionOptionLabel(region) }}
                </option>
              </select>
            </div>
            <div class="advanced-row">
              <span>{{ t('googleRegion') }}</span>
              <select v-model="editing.sources.google.area" class="field-input region-select" :disabled="!editing.sources.google.enabled">
                <option v-for="region in googleRegions" :key="region.code || 'default'" :value="region.code">
                  {{ region.label }}
                </option>
              </select>
            </div>
            <div class="advanced-row">
              <span>{{ t('sensitivity') }}</span>
              <div class="segmented sensitivity">
                <button
                  v-for="sensitivity in SENSITIVITIES"
                  :key="sensitivity.id"
                  type="button"
                  :class="{ active: editing.sensitivity === sensitivity.id }"
                  @click="editing.sensitivity = sensitivity.id"
                >
                  {{ sensitivity.label }}
                </button>
              </div>
            </div>
            <p class="hint">{{ t('advancedHint') }}</p>
          </div>
        </section>
      </div>
    </GlassPanel>
  </main>
</template>

<style scoped>
.options {
  position: relative;
  max-width: 720px;
  margin: 0 auto;
  padding: 28px 20px 48px;
  display: grid;
  gap: 16px;
}

.page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.brand { display: flex; align-items: center; gap: 10px; }
.brand-mark { width: 24px; height: 24px; }
.brand h1 { font-size: 17px; }

.saved-flash {
  font-size: 13px;
  font-weight: 650;
  color: var(--accent-rise);
}

.panel-inner { padding: 20px; display: grid; gap: 18px; }

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.panel-head h2 { font-size: 15px; }
.head-actions { display: flex; gap: 8px; }

.hint { font-size: 12px; color: var(--text-tertiary); }

.form-error {
  font-size: 12px;
  color: var(--accent-fail);
  padding: 8px 12px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--accent-fail) 12%, transparent);
}

.sub-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }

.sub-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 16px;
  background: color-mix(in srgb, var(--text) 5%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--text) 4%, transparent);
  transition: transform 0.2s cubic-bezier(0.32, 0.72, 0.35, 1.1), box-shadow 0.2s ease;
}
.sub-row:hover {
  transform: translateY(-1px);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--text) 8%, transparent), 0 6px 16px -12px rgba(20, 30, 60, 0.5);
}
.sub-row.disabled :is(.sub-icon, .sub-info) { opacity: 0.5; }

.sub-info { flex: 1; min-width: 0; display: grid; gap: 2px; }
.sub-info strong { font-size: 14px; }
.sub-meta {
  font-size: 11px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sub-actions { display: flex; align-items: center; gap: 8px; }

.block { display: grid; gap: 10px; }
.block-label { font-size: 12px; font-weight: 650; color: var(--text-secondary); }

.name-row { display: flex; align-items: center; gap: 12px; }

.icon-btn {
  position: relative;
  flex: none;
  border-radius: 14px;
  transition: transform 0.2s cubic-bezier(0.3, 1.3, 0.5, 1);
}
.icon-btn:hover { transform: scale(1.06); }
.icon-btn:active { transform: scale(0.96); }
.icon-btn-edit {
  position: absolute;
  right: -3px;
  bottom: -3px;
  width: 16px;
  height: 16px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  color: var(--text-secondary);
  background: var(--glass-fill-strong);
  box-shadow: 0 1px 4px rgba(15, 25, 55, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.5);
}

.icon-picker {
  display: grid;
  gap: 10px;
  padding: 12px;
  border-radius: 16px;
  background: color-mix(in srgb, var(--text) 4%, transparent);
}
.icon-row { display: flex; gap: 8px; }

.source-note { font-size: 11px; color: var(--text-tertiary); }

.advanced-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 650;
  color: var(--text-secondary);
  justify-self: start;
}
.advanced-toggle:hover { color: var(--text); }
.advanced-chevron { transition: transform 0.25s cubic-bezier(0.3, 1.3, 0.5, 1); }
.advanced-chevron.open { transform: rotate(90deg); }

.advanced-body {
  display: grid;
  gap: 10px;
  padding: 12px;
  border-radius: 16px;
  background: color-mix(in srgb, var(--text) 4%, transparent);
}
.advanced-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 13px;
}

.emoji-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(36px, 1fr));
  gap: 6px;
}
.emoji-cell {
  height: 36px;
  display: grid;
  place-items: center;
  font-size: 18px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--text) 5%, transparent);
  transition: transform 0.18s cubic-bezier(0.3, 1.4, 0.45, 1), box-shadow 0.18s ease;
}
.emoji-cell:hover { transform: scale(1.12); }
.emoji-cell.active {
  box-shadow: 0 0 0 2px var(--brand-a);
  background: color-mix(in srgb, var(--brand-a) 14%, transparent);
}

.chips { display: flex; flex-wrap: wrap; gap: 6px; min-height: 4px; }
.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  color: #fff;
  background: var(--control-accent);
  box-shadow: 0 3px 8px -4px rgba(0, 122, 255, 0.7);
}
.chip-x { color: rgba(255, 255, 255, 0.85); display: grid; place-items: center; }

.kw-input-row { display: flex; gap: 8px; }
.kw-input-row .field-input { flex: 1; }

.source-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.source-name { display: flex; align-items: center; gap: 10px; font-weight: 600; }
.region-select { max-width: 220px; }

.template-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(148px, 1fr));
  gap: 10px;
}

.template-card {
  position: relative;
  display: grid;
  gap: 4px;
  padding: 12px;
  border-radius: 16px;
  text-align: left;
  background: color-mix(in srgb, var(--text) 5%, transparent);
  transition: transform 0.2s cubic-bezier(0.3, 1.3, 0.5, 1), box-shadow 0.2s ease;
}
.template-card:hover { transform: translateY(-2px); }
.template-card.active {
  box-shadow: 0 0 0 2px var(--brand-a), 0 8px 18px -10px rgba(10, 132, 255, 0.6);
  background: color-mix(in srgb, var(--brand-a) 10%, transparent);
}
.template-card strong { font-size: 13px; }
.template-card span { font-size: 11px; color: var(--text-secondary); }
.template-curve { width: 100%; height: 34px; }
.template-check { position: absolute; top: 8px; right: 8px; }

.custom-config {
  display: grid;
  gap: 10px;
  padding: 12px;
  border-radius: 16px;
  background: color-mix(in srgb, var(--text) 5%, transparent);
}
.custom-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
}

.sensitivity { justify-self: start; }
</style>

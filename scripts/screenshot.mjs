/**
 * Dev utility: load the built extension into headless Edge/Chromium, inject
 * demo data, and screenshot the popup and options pages (light + dark).
 * Usage: node scripts/screenshot.mjs [outDir]
 */
import { existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import puppeteer from 'puppeteer-core'

const DIST = resolve(import.meta.dirname, '../dist')
const OUT = resolve(process.argv[2] ?? '/tmp/kw-shots')
mkdirSync(OUT, { recursive: true })

const executablePath = [
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find(p => existsSync(p))

const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: [
    `--disable-extensions-except=${DIST}`,
    `--load-extension=${DIST}`,
    '--no-first-run',
    '--window-size=900,700',
  ],
})

const target = await browser.waitForTarget(
  t => t.type() === 'service_worker' && t.url().startsWith('chrome-extension://'),
  { timeout: 20000 },
)
const worker = await target.worker()
const extensionId = new URL(target.url()).hostname

// Wait for seed, then inject demo series + one alert so charts/badges render.
await worker.evaluate(async () => {
  for (let i = 0; i < 40; i += 1) {
    const stored = await chrome.storage.local.get('kw:subs')
    if (Array.isArray(stored['kw:subs']) && stored['kw:subs'].length > 0) break
    await new Promise(r => setTimeout(r, 250))
  }
  const { 'kw:subs': subs } = await chrome.storage.local.get('kw:subs')
  const sub = subs[0]

  const mk = (level, surge) => {
    const points = []
    const start = Date.now() - 89 * 86400000
    for (let i = 0; i < 90; i += 1) {
      let v = level * (1 + 0.06 * Math.sin(i * 1.7) + 0.04 * Math.sin(i * 0.4))
      if (surge && i > 82) v = level * (1.2 + (i - 82) * 0.18)
      if (i % 29 === 13) { points.push({ date: new Date(start + i * 86400000).toISOString().slice(0, 10), value: null }); continue }
      points.push({ date: new Date(start + i * 86400000).toISOString().slice(0, 10), value: Math.round(v) })
    }
    return points
  }

  const patch = {}
  const dates = []
  for (const [k, kw] of sub.keywords.entries()) {
    patch[`kw:series:${sub.id}:baidu:${encodeURIComponent(kw)}`] = mk(3000 + k * 800, k === 0)
    patch[`kw:series:${sub.id}:google:${encodeURIComponent(kw)}`] = mk(50 + k * 8, k === 0)
  }
  const today = new Date().toISOString().slice(0, 10)
  patch['kw:alerts'] = [{
    id: 'demo', subscriptionId: sub.id,
    message: `${sub.name}：关联关键词近期搜索热度显著上升`,
    direction: 'up',
    contributions: [
      { source: 'baidu', keyword: sub.keywords[0], direction: 'up', score: 2.1, dataDate: today },
      { source: 'google', keyword: sub.keywords[0], direction: 'up', score: 1.7, dataDate: today },
    ],
    createdAt: Date.now() - 3600e3, read: false,
  }]
  patch[`kw:meta:${sub.id}:baidu`] = { status: 'ok', lastCheckAt: Date.now() - 12 * 60e3, latestDataDate: today, error: null }
  patch[`kw:meta:${sub.id}:google`] = { status: 'failed', lastCheckAt: Date.now() - 12 * 60e3, latestDataDate: today, error: 'Google Trends 获取失败' }
  patch['kw:lastCheckAt'] = Date.now() - 12 * 60e3
  await chrome.storage.local.set(patch)
})

async function shoot(path, url, { width, height, dark, fullPage = false, prep }) {
  const page = await browser.newPage()
  await page.setViewport({ width, height, deviceScaleFactor: 2 })
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' }])
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 })
  await new Promise(r => setTimeout(r, 900))
  if (prep) await prep(page)
  await page.screenshot({ path: `${OUT}/${path}`, fullPage })
  await page.close()
}

const popupUrl = `chrome-extension://${extensionId}/src/pages/popup/index.html`
const optionsUrl = `chrome-extension://${extensionId}/src/pages/options/index.html`

await shoot('popup-light.png', popupUrl, { width: 384, height: 584 })
await shoot('popup-dark.png', popupUrl, { width: 384, height: 584, dark: true })
await shoot('popup-expanded.png', popupUrl, {
  width: 384, height: 584,
  prep: async (page) => {
    await page.click('.sub-card .card-body')
    await new Promise(r => setTimeout(r, 600))
  },
})
// Baidu auth-failure state: login banner + per-chart hint.
await worker.evaluate(async () => {
  const { 'kw:subs': subs } = await chrome.storage.local.get('kw:subs')
  const sub = subs[0]
  const patch = {}
  patch[`kw:meta:${sub.id}:baidu`] = {
    status: 'failed', lastCheckAt: Date.now() - 5 * 60e3,
    latestDataDate: null, error: '未登录百度或没有百度指数权限', reason: 'auth',
  }
  for (const kw of sub.keywords) {
    patch[`kw:series:${sub.id}:baidu:${encodeURIComponent(kw)}`] = []
  }
  await chrome.storage.local.set(patch)
})
await shoot('popup-login.png', popupUrl, { width: 384, height: 584 })

await shoot('options-light.png', optionsUrl, { width: 900, height: 700 })
await shoot('options-editor.png', optionsUrl, {
  width: 900, height: 700, fullPage: true,
  prep: async (page) => {
    await page.click('.sub-actions .btn')
    await new Promise(r => setTimeout(r, 600))
  },
})

await browser.close()
console.log(`Screenshots written to ${OUT}`)

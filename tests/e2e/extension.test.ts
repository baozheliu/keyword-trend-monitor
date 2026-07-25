/**
 * Real-browser test: loads the built extension into an actual Chrome
 * instance (new headless supports MV3 extensions), verifies the service
 * worker boots, storage is seeded with the default subscription, the
 * detection engine runs inside the extension context, and the popup renders.
 *
 * Requires `npm run build` first (asserted below) and a local Chrome.
 */
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import puppeteer, { type Browser } from 'puppeteer-core'

const DIST = resolve(__dirname, '../../dist')
// Branded Chrome ≥137 dropped --load-extension; Edge and Chromium/Chrome
// for Testing still support it, so Edge is preferred when available.
const CHROME_PATHS = [
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
]

const executablePath = CHROME_PATHS.find(path => existsSync(path))

describe.skipIf(!executablePath || !existsSync(DIST))('extension in a real browser', () => {
  let browser: Browser

  beforeAll(async () => {
    browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: [
        `--disable-extensions-except=${DIST}`,
        `--load-extension=${DIST}`,
        '--lang=zh-CN',
        '--no-first-run',
        '--disable-features=DialMediaRouteProvider',
      ],
    })
  }, 60_000)

  afterAll(async () => {
    await browser?.close()
  })

  async function serviceWorkerTarget() {
    return browser.waitForTarget(
      target => target.type() === 'service_worker' && target.url().startsWith('chrome-extension://'),
      { timeout: 20_000 },
    )
  }

  it('boots the MV3 service worker', async () => {
    const target = await serviceWorkerTarget()
    expect(target.url()).toMatch(/^chrome-extension:\/\/[a-p]{32}\//)
  })

  it('seeds the default subscription (新冠趋势关注) into local storage', async () => {
    const target = await serviceWorkerTarget()
    const worker = await target.worker()
    expect(worker).not.toBeNull()

    const subscriptions = await worker!.evaluate(async () => {
      for (let attempt = 0; attempt < 40; attempt += 1) {
        const stored = await chrome.storage.local.get('kw:subs')
        const subs = stored['kw:subs']
        if (Array.isArray(subs) && subs.length > 0) return subs
        await new Promise(resolvePoll => setTimeout(resolvePoll, 250))
      }
      return []
    }) as Array<{ name: string, keywords: string[], template: string, sensitivity: string }>

    expect(subscriptions).toHaveLength(1)
    expect(subscriptions[0]!.name).toBe('新冠趋势关注')
    expect(subscriptions[0]!.keywords).toEqual(['新冠', '新冠病毒', '新冠肺炎', 'COVID-19', 'coronavirus'])
    expect(subscriptions[0]!.template).toBe('smart')
    expect(subscriptions[0]!.sensitivity).toBe('standard')
  }, 30_000)

  it('renders the popup with header, refresh control and the default card', async () => {
    const target = await serviceWorkerTarget()
    const extensionId = new URL(target.url()).hostname

    const page = await browser.newPage()
    await page.goto(`chrome-extension://${extensionId}/src/pages/popup/index.html`, {
      waitUntil: 'networkidle0',
      timeout: 30_000,
    })

    await page.waitForSelector('.popup-header', { timeout: 15_000 })
    const headerText = await page.$eval('.popup-header', el => el.textContent ?? '')
    expect(headerText).toContain('Keyword Watch')

    await page.waitForSelector('.sub-card', { timeout: 15_000 })
    const cardText = await page.$eval('.sub-card', el => el.textContent ?? '')
    expect(cardText).toContain('新冠趋势关注')

    const refreshButton = await page.$('button[title="手动刷新"]')
    expect(refreshButton).not.toBeNull()
    await page.close()
  }, 45_000)

  it('renders the options page with the template picker', async () => {
    const target = await serviceWorkerTarget()
    const extensionId = new URL(target.url()).hostname

    const page = await browser.newPage()
    await page.goto(`chrome-extension://${extensionId}/src/pages/options/index.html`, {
      waitUntil: 'networkidle0',
      timeout: 30_000,
    })

    await page.waitForSelector('.sub-row', { timeout: 15_000 })
    await page.click('.sub-actions .btn') // 编辑
    await page.waitForSelector('.template-grid', { timeout: 10_000 })
    const templates = await page.$$eval('.template-card strong', els => els.map(el => el.textContent))
    expect(templates).toEqual(['智能监测', '快速升温', '持续上升', '趋势反转', '异常下降', '剧烈波动', '自定义规则'])
    await page.close()
  }, 45_000)

  it('detects a synthetic surge end-to-end inside the real worker', async () => {
    const target = await serviceWorkerTarget()
    const worker = await target.worker()

    // Inject a synthetic surge series for the default subscription. The
    // fetches themselves may fail in the test environment (no Baidu login);
    // that must surface as a source failure, never block evaluation.
    await worker!.evaluate(async () => {
      const stored = await chrome.storage.local.get('kw:subs')
      type StoredSub = {
        id: string
        keywords: string[]
        sources: { baidu: { enabled: boolean }, google: { enabled: boolean } }
      }
      const sub = (stored['kw:subs'] as StoredSub[])[0]!
      // Shrink the subscription to one keyword × one source so the network
      // part of the check stays small; the engine path is unchanged.
      sub.keywords = ['新冠']
      sub.sources.google.enabled = false
      await chrome.storage.local.set({ 'kw:subs': [sub] })

      const points: Array<{ date: string, value: number }> = []
      const start = Date.parse('2026-01-01T00:00:00Z')
      for (let i = 0; i < 57; i += 1) {
        const base = i < 50 ? 100 + Math.sin(i * 2.4) * 3 : 300 + (i - 50) * 40
        points.push({
          date: new Date(start + i * 86_400_000).toISOString().slice(0, 10),
          value: Math.round(base),
        })
      }
      await chrome.storage.local.set({
        [`kw:series:${sub.id}:baidu:${encodeURIComponent('新冠')}`]: points,
      })
    })

    // Trigger a forced check through the real message channel. The first
    // install-time check may still be running; REFRESH_NOW joins it, so a
    // second refresh guarantees the injected series gets evaluated.
    const extensionId = new URL(target.url()).hostname
    const page = await browser.newPage()
    await page.goto(`chrome-extension://${extensionId}/src/pages/popup/index.html`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    })
    await page.evaluate(async () => {
      const refresh = () => new Promise(resolveMsg => {
        chrome.runtime.sendMessage({ type: 'REFRESH_NOW', payload: {} }, () => resolveMsg(null))
      })
      await refresh()
      await refresh()
    })

    const alerts = await worker!.evaluate(async () => {
      const stored = await chrome.storage.local.get('kw:alerts')
      return stored['kw:alerts'] ?? []
    }) as Array<{ message: string, direction: string }>

    expect(alerts.length).toBeGreaterThanOrEqual(1)
    expect(alerts[0]!.direction).toBe('up')
    expect(alerts[0]!.message).toContain('新冠趋势关注：关联关键词近期搜索热度显著上升')
    await page.close()
  }, 300_000)
})

/**
 * Renders public/assets/icon.svg (the same brand mark used in the popup and
 * options headers) into the toolbar PNG sizes with a transparent background.
 * Usage: node scripts/make-icons.mjs
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import puppeteer from 'puppeteer-core'

const ROOT = resolve(import.meta.dirname, '..')
const SVG = readFileSync(resolve(ROOT, 'public/assets/icon.svg'), 'utf8')
const SIZES = [16, 32, 48, 128]

const executablePath = [
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find(p => existsSync(p))

const browser = await puppeteer.launch({ executablePath, headless: true })
const page = await browser.newPage()

for (const size of SIZES) {
  await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 })
  await page.setContent(`<!doctype html><style>
    html, body { margin: 0; background: transparent; }
    svg { display: block; width: ${size}px; height: ${size}px; }
  </style>${SVG}`)
  await page.screenshot({
    path: resolve(ROOT, `public/assets/icons/icon${size}.png`),
    omitBackground: true,
  })
  console.log(`icon${size}.png`)
}

await browser.close()

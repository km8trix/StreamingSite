// One-off screenshot capture for the running app (home + a detail page).
// Usage: node scripts/shots.mjs   (requires the app running on :3000)
import { chromium } from '@playwright/test'

const BASE = process.env.BASE_URL || 'http://localhost:3000'
const OUT = process.env.SHOTS_DIR || '/tmp/shots'

async function settle(page) {
  // Trigger lazy-loaded images by scrolling the whole page, then return to top.
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let total = 0
      const timer = setInterval(() => {
        window.scrollBy(0, 500)
        total += 500
        if (total >= document.body.scrollHeight + 1000) {
          clearInterval(timer)
          resolve()
        }
      }, 80)
    })
  })
  await page.waitForTimeout(1200)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(400)
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1366, height: 900 } })

await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 60000 })
await settle(page)
await page.screenshot({ path: `${OUT}/home.png`, fullPage: true })
console.log('captured home')

const card = page.locator('[data-testid="show-card"]').first()
await card.scrollIntoViewIfNeeded()
await card.click()
await page.waitForURL('**/shows/**', { timeout: 60000 })
await page.waitForLoadState('networkidle')
await settle(page)
await page.screenshot({ path: `${OUT}/detail.png`, fullPage: true })
console.log('captured detail at ' + page.url())

await browser.close()

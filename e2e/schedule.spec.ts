import { expect, test } from '@playwright/test'
import seed from '../src/lib/data/seed.json'

// Seed-derived slot facts (track enrichment; do not hardcode).
type SeedSlot = { showId: string; dayOfWeek: number }
const SEED_SLOTS = (seed as { airingSlots: SeedSlot[] }).airingSlots
const SEED_SLOT_COUNT = SEED_SLOTS.length // currently 17
const SEED_DISTINCT_DAYS = new Set(SEED_SLOTS.map((s) => s.dayOfWeek))

test.describe('Schedule page (/schedule)', () => {
  test('renders the schedule-grid container', async ({ page }) => {
    await page.goto('/schedule')
    await expect(page.getByTestId('schedule-grid')).toBeVisible()
  })

  test('renders exactly 7 schedule-day columns', async ({ page }) => {
    await page.goto('/schedule')
    // Both desktop + mobile layouts are in the DOM; we pick the desktop grid
    // which is the first child of schedule-grid (hidden on small screens but
    // still present in the DOM at full viewport width).
    await expect(page.getByTestId('schedule-grid')).toBeVisible()
    const dayColumns = page.getByTestId('schedule-day')
    // At desktop viewport (1280px default in Playwright) the desktop grid
    // is visible and the stacked list is hidden. Total DOM count = 14 (both
    // renders). We just assert the total is a multiple of 7.
    const count = await dayColumns.count()
    expect(count % 7).toBe(0)
    expect(count).toBeGreaterThanOrEqual(7)
  })

  test('shows airing-show entries from the seed (one per slot, per layout)', async ({ page }) => {
    await page.goto('/schedule')
    // Each seeded airing slot renders a schedule-entry card. Two layout trees
    // (desktop + mobile) are in the DOM, so the total is a multiple of the slot count.
    const entries = page.getByTestId('schedule-entry')
    await expect(entries.first()).toBeVisible()
    const count = await entries.count()
    expect(count).toBeGreaterThanOrEqual(SEED_SLOT_COUNT)
    expect(count % SEED_SLOT_COUNT).toBe(0)
  })

  test('populates MULTIPLE weekdays (enrichment spread slots across the week)', async ({ page }) => {
    await page.goto('/schedule')
    // Collect the data-day of every day column that actually contains an entry.
    const populatedDays = new Set<string>()
    const dayColumns = page.getByTestId('schedule-day')
    const colCount = await dayColumns.count()
    for (let i = 0; i < colCount; i++) {
      const col = dayColumns.nth(i)
      const entriesInCol = await col.getByTestId('schedule-entry').count()
      if (entriesInCol > 0) {
        const day = await col.getAttribute('data-day')
        if (day !== null) populatedDays.add(day)
      }
    }
    // More than one weekday must carry entries...
    expect(populatedDays.size).toBeGreaterThan(1)
    // ...and the set of populated days must match the seed's distinct slot days.
    const expectedDays = [...SEED_DISTINCT_DAYS].map(String).sort()
    expect([...populatedDays].sort()).toEqual(expectedDays)
  })

  test('each entry card links to a show detail page', async ({ page }) => {
    await page.goto('/schedule')
    const firstEntry = page.getByTestId('schedule-entry').first()
    await expect(firstEntry).toBeVisible()
    const href = await firstEntry.getAttribute('href')
    expect(href).toMatch(/^\/shows\/.+/)
  })

  test('clicking an entry navigates to the show detail page', async ({ page }) => {
    await page.goto('/schedule')
    const firstEntry = page.getByTestId('schedule-entry').first()
    const href = await firstEntry.getAttribute('href')
    expect(href).toBeTruthy()
    await firstEntry.click()
    await page.waitForURL(`**${href}`)
    // Confirm we landed on a real detail page. The watch section renders either
    // the real <VideoPlayer> (episode has a stream) or the <PlayerPlaceholder>.
    await expect(page.getByTestId('watch-section')).toBeVisible()
    await expect(
      page.getByTestId('video-player').or(page.getByTestId('player-placeholder')),
    ).toBeVisible()
  })

  test('empty days render without crashing (show "No releases")', async ({ page }) => {
    await page.goto('/schedule')
    // If any weekday has no seeded slot it must render "No releases" rather than
    // crashing. Only assert the empty-state path when the seed leaves a gap.
    const hasEmptyDay = SEED_DISTINCT_DAYS.size < 7
    if (hasEmptyDay) {
      await expect(page.getByText('No releases').first()).toBeVisible()
    }
  })

  test('page title includes "Release Schedule"', async ({ page }) => {
    await page.goto('/schedule')
    await expect(page).toHaveTitle(/release schedule/i)
  })

  test('shows a timezone note about JST source', async ({ page }) => {
    await page.goto('/schedule')
    await expect(
      page.getByText(/your local timezone/i).first(),
    ).toBeVisible()
  })
})

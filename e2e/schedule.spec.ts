import { expect, test } from '@playwright/test'
import seed from '../src/lib/data/seed.json'

// Seed-derived slot facts (track enrichment; do not hardcode).
type SeedSlot = { showId: string; dayOfWeek: number }
const SEED_SLOTS = (seed as { airingSlots: SeedSlot[] }).airingSlots
const SEED_DISTINCT_DAYS = new Set(SEED_SLOTS.map((s) => s.dayOfWeek))

test.describe('Schedule page (/schedule) — day picker', () => {
  test('renders the picker container and 7 day tabs', async ({ page }) => {
    await page.goto('/schedule')
    await expect(page.getByTestId('schedule-grid')).toBeVisible()
    await expect(page.getByTestId('schedule-day-tab')).toHaveCount(7)
  })

  test('day tabs are labelled with date + weekday and a live "Now" clock', async ({
    page,
  }) => {
    await page.goto('/schedule')
    // Abbreviated month + day appears in the tab strip (e.g. "Jun 17").
    await expect(
      page.getByTestId('schedule-grid').getByText(
        /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\b/,
      ).first(),
    ).toBeVisible()
    await expect(page.getByText(/^Now:/)).toBeVisible()
  })

  test('selecting each day reveals that day\'s releases; populated days match the seed', async ({
    page,
  }) => {
    await page.goto('/schedule')
    const tabs = page.getByTestId('schedule-day-tab')
    await expect(tabs).toHaveCount(7)

    const populated = new Set<string>()
    for (let i = 0; i < 7; i++) {
      await tabs.nth(i).click()
      const day = await tabs.nth(i).getAttribute('data-day')
      const count = await page.getByTestId('schedule-entry').count()
      if (count > 0 && day) populated.add(day)
    }

    expect(populated.size).toBeGreaterThan(1)
    expect([...populated].sort()).toEqual(
      [...SEED_DISTINCT_DAYS].map(String).sort(),
    )
  })

  test('an entry shows an estimated episode pill and links to the show', async ({
    page,
  }) => {
    await page.goto('/schedule')
    const tabs = page.getByTestId('schedule-day-tab')

    // Select the first day (of the visible week) that actually has releases.
    let href: string | null = null
    for (let i = 0; i < 7; i++) {
      await tabs.nth(i).click()
      if ((await page.getByTestId('schedule-entry').count()) > 0) {
        const first = page.getByTestId('schedule-entry').first()
        await expect(first).toBeVisible()
        await expect(first.getByText(/Episode \d+/)).toBeVisible()
        href = await first.getAttribute('href')
        break
      }
    }
    expect(href).toMatch(/^\/shows\/.+/)
  })

  test('clicking an entry navigates to the show detail page', async ({
    page,
  }) => {
    await page.goto('/schedule')
    const tabs = page.getByTestId('schedule-day-tab')
    for (let i = 0; i < 7; i++) {
      await tabs.nth(i).click()
      if ((await page.getByTestId('schedule-entry').count()) > 0) {
        const first = page.getByTestId('schedule-entry').first()
        const href = await first.getAttribute('href')
        await first.click()
        await page.waitForURL(`**${href}`)
        await expect(page.getByTestId('watch-section')).toBeVisible()
        return
      }
    }
    throw new Error('No schedule entries found on any day of the visible week')
  })

  test('a day with no releases shows the empty state', async ({ page }) => {
    // Only assert when the seed leaves at least one weekday empty.
    test.skip(
      SEED_DISTINCT_DAYS.size >= 7,
      'every weekday has a seeded slot — no empty day to assert',
    )
    await page.goto('/schedule')
    const tabs = page.getByTestId('schedule-day-tab')
    for (let i = 0; i < 7; i++) {
      await tabs.nth(i).click()
      const day = await tabs.nth(i).getAttribute('data-day')
      if (day && !SEED_DISTINCT_DAYS.has(Number(day))) {
        await expect(page.getByTestId('schedule-empty')).toBeVisible()
        return
      }
    }
  })

  test('page title includes "Release Schedule" and shows the timezone note', async ({
    page,
  }) => {
    await page.goto('/schedule')
    await expect(page).toHaveTitle(/release schedule/i)
    await expect(page.getByText(/your local timezone/i)).toBeVisible()
  })
})

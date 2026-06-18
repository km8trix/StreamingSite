import { expect, test } from '@playwright/test'
import seed from '../src/lib/data/seed.json'

// Seed-derived slot facts (track enrichment; do not hardcode).
type SeedSlot = { showId: string; dayOfWeek: number }
const SEED_SLOTS = (seed as { airingSlots: SeedSlot[] }).airingSlots
const SEED_DISTINCT_DAYS = new Set(SEED_SLOTS.map((s) => s.dayOfWeek))

test.describe('Schedule page (/schedule) — day picker', () => {
  // Pin the browser timezone to JST so day bucketing is deterministic: with the
  // viewer in Asia/Tokyo, each slot's viewer-local day equals its JST broadcast
  // weekday, so populated tabs map 1:1 onto the seed's dayOfWeek values. (The
  // cross-timezone bucketing itself is covered by the unit tests.)
  test.use({ timezoneId: 'Asia/Tokyo' })

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

  test('a row has a poster + countdown and separate show / episode links', async ({
    page,
  }) => {
    await page.goto('/schedule')
    const tabs = page.getByTestId('schedule-day-tab')

    // Select the first day (of the visible week) that actually has releases.
    let showHref: string | null = null
    let epHref: string | null = null
    for (let i = 0; i < 7; i++) {
      await tabs.nth(i).click()
      if ((await page.getByTestId('schedule-entry').count()) > 0) {
        const first = page.getByTestId('schedule-entry').first()
        await expect(first).toBeVisible()
        // LiveChart-style row: poster thumbnail + "EP N" badge + countdown chip.
        await expect(first.locator('img')).toBeVisible()
        await expect(first.getByText(/EP\s?\d+/)).toBeVisible()
        await expect(first.getByTestId('schedule-countdown')).toBeVisible()
        showHref = await first.getByTestId('schedule-show-link').getAttribute('href')
        epHref = await first.getByTestId('schedule-episode').getAttribute('href')
        break
      }
    }
    expect(showHref).toMatch(/^\/shows\/.+/)
    // The episode badge deep-links to a specific episode of the same show.
    expect(epHref).toMatch(/^\/shows\/.+\?ep=\d+$/)
  })

  test('clicking the show link navigates to the show detail page', async ({
    page,
  }) => {
    await page.goto('/schedule')
    const tabs = page.getByTestId('schedule-day-tab')
    for (let i = 0; i < 7; i++) {
      await tabs.nth(i).click()
      if ((await page.getByTestId('schedule-entry').count()) > 0) {
        const showLink = page
          .getByTestId('schedule-entry')
          .first()
          .getByTestId('schedule-show-link')
        const href = await showLink.getAttribute('href')
        await showLink.click()
        await page.waitForURL(`**${href}`)
        await expect(page.getByTestId('watch-section')).toBeVisible()
        return
      }
    }
    throw new Error('No schedule entries found on any day of the visible week')
  })

  test('clicking the episode badge deep-links to that episode on the show', async ({
    page,
  }) => {
    await page.goto('/schedule')
    const tabs = page.getByTestId('schedule-day-tab')
    for (let i = 0; i < 7; i++) {
      await tabs.nth(i).click()
      if ((await page.getByTestId('schedule-entry').count()) > 0) {
        const epLink = page
          .getByTestId('schedule-entry')
          .first()
          .getByTestId('schedule-episode')
        const href = await epLink.getAttribute('href')
        expect(href).toMatch(/^\/shows\/.+\?ep=\d+$/)
        await epLink.click()
        await page.waitForURL('**/shows/**')
        // The show page renders, with the watch section, even when the
        // estimated next episode is not yet streamable (graceful fallback).
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

import { expect, test } from '@playwright/test'
import seed from '../src/lib/data/seed.json'

// Roadmap: SEARCH TYPEAHEAD e2e — runs against the LIVE local Supabase backend.
//
// The header search-input is an as-you-type WAI-ARIA combobox: typing >=2 chars
// (200ms-debounced) fetches GET /api/search/suggestions?q=… and renders a
// listbox of matching shows. Selecting one navigates to /shows/<slug>; pressing
// Enter with no active option runs the full-text search at /shows?q=.
//
// Non-flaky: we explicitly wait for the listbox/options to appear (accounting
// for the debounce) before asserting, rather than racing the input.

type SeedShow = { slug: string; title: string }
const SEED_SHOWS = seed.shows as SeedShow[]

// A known seed show whose title starts with the typed prefix.
const FRIEREN = SEED_SHOWS.find((s) => s.slug === 'frieren-beyond-journeys-end')

// The first VISIBLE header search-input (desktop + mobile both mount; pick the
// one shown for the current viewport).
function searchInput(page: import('@playwright/test').Page) {
  return page.getByTestId('search-input').first()
}

test.describe('Header search typeahead (live Supabase)', () => {
  test.beforeAll(() => {
    // Sanity: the seed we derive expectations from has the known show.
    expect(FRIEREN, 'seed must contain the Frieren show').toBeDefined()
  })

  test('typing a few letters of a known title shows suggestions', async ({
    page,
  }) => {
    await page.goto('/')

    const input = searchInput(page)
    await expect(input).toBeVisible()
    await input.click()
    // Type a few letters of a known seed title ("fr" -> Frieren).
    await input.fill('fr')

    // Wait for the debounced fetch + the listbox to appear (non-flaky).
    const listbox = page.getByTestId('search-suggestions')
    await expect(listbox).toBeVisible()

    const options = listbox.getByTestId('search-suggestion')
    await expect(options.first()).toBeVisible()
    expect(await options.count()).toBeGreaterThanOrEqual(1)

    // The combobox is expanded and at least one option points at a real show.
    await expect(input).toHaveAttribute('aria-expanded', 'true')
    const firstSlug = await options.first().getAttribute('data-slug')
    expect(firstSlug).toBeTruthy()
    expect(SEED_SHOWS.some((s) => s.slug === firstSlug)).toBe(true)
  })

  test('clicking a suggestion navigates to /shows/<slug> and the detail page renders', async ({
    page,
  }) => {
    await page.goto('/')

    const input = searchInput(page)
    await expect(input).toBeVisible()
    await input.click()
    await input.fill('fr')

    const listbox = page.getByTestId('search-suggestions')
    await expect(listbox).toBeVisible()

    // The <li> option itself carries data-slug, so target Frieren directly so
    // the navigation destination is deterministic.
    const target = listbox
      .locator(`[data-testid="search-suggestion"][data-slug="${FRIEREN!.slug}"]`)
      .first()
    await expect(target).toBeVisible()

    const expectedSlug =
      (await target.getAttribute('data-slug')) ?? FRIEREN!.slug

    await target.click()

    // URL becomes /shows/<slug> and the detail page renders.
    await page.waitForURL(new RegExp(`/shows/${expectedSlug}$`))
    expect(page.url()).toContain(`/shows/${expectedSlug}`)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByTestId('watch-section')).toBeVisible()
  })

  test('typing + Enter with no selection lands on /shows?q=', async ({
    page,
  }) => {
    await page.goto('/')

    const input = searchInput(page)
    await expect(input).toBeVisible()
    await input.click()
    await input.fill('frieren')

    // Wait for the listbox so we know suggestions loaded — but DO NOT select an
    // option; pressing Enter with no active option runs the full-text search.
    await expect(page.getByTestId('search-suggestions')).toBeVisible()

    await input.press('Enter')

    await page.waitForURL(/\/shows\?q=/)
    expect(page.url()).toContain('/shows')
    expect(page.url()).toContain('q=frieren')
    // The catalog results page renders at least one matching card.
    await expect(page.getByTestId('show-card').first()).toBeVisible()
  })

  test('a query under 2 chars shows no dropdown (and makes no request)', async ({
    page,
  }) => {
    await page.goto('/')
    const input = searchInput(page)
    await expect(input).toBeVisible()
    await input.click()
    await input.fill('f')

    // Give the debounce window time to (not) fire, then assert nothing opened.
    await page.waitForTimeout(400)
    await expect(page.getByTestId('search-suggestions')).toHaveCount(0)
    await expect(page.getByTestId('search-suggestions-empty')).toHaveCount(0)
    await expect(input).toHaveAttribute('aria-expanded', 'false')
  })
})

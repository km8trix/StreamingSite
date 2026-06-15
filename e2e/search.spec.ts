import { expect, test } from '@playwright/test'
import seed from '../src/lib/data/seed.json'

// Seed-derived expected counts (do NOT hardcode; these track enrichment).
type SeedShow = { status: string; subEpisodes: number; dubEpisodes: number }
const SEED_SHOWS = seed.shows as SeedShow[]
const SEED_TOTAL = SEED_SHOWS.length // total catalog size (currently 39)
const SEED_AIRING = SEED_SHOWS.filter((s) => s.status === 'airing').length // currently 17
const SEED_SUBBED = SEED_SHOWS.filter((s) => s.subEpisodes > 0).length // currently 39
const SEED_DUBBED = SEED_SHOWS.filter((s) => s.dubEpisodes > 0).length // currently 21

test.describe('Search page (/search)', () => {
  // ---------------------------------------------------------------------------
  // Basic page render
  // ---------------------------------------------------------------------------

  test('search page renders with filter panel and results area', async ({ page }) => {
    await page.goto('/search')
    await expect(page.getByTestId('filter-panel')).toBeVisible()
    await expect(page.getByTestId('search-results')).toBeVisible()
  })

  test('visiting /search with no query shows all shows (default: show everything)', async ({ page }) => {
    await page.goto('/search')
    // The search page defaults to showing the full catalog when no query/filter is active.
    // result-count shows "N shows found" and the count must equal the seed total.
    await expect(page.getByTestId('result-count')).toContainText(
      new RegExp(`${SEED_TOTAL}\\s+shows? found`, 'i'),
    )
    const count = await page.getByTestId('show-card').count()
    expect(count).toBe(SEED_TOTAL)
  })

  // ---------------------------------------------------------------------------
  // Query: matching title
  // ---------------------------------------------------------------------------

  test('?q= matching a seed title shows results (result-count > 0)', async ({ page }) => {
    // 'frieren' matches exactly 1 seed show
    await page.goto('/search?q=frieren')
    const countEl = page.getByTestId('result-count')
    await expect(countEl).toBeVisible()
    // Should show "1 show found"
    await expect(countEl).toContainText(/1 show/i)
    // At least one show card visible
    await expect(page.getByTestId('show-card').first()).toBeVisible()
  })

  test('?q= matching multiple titles shows >1 card', async ({ page }) => {
    // 'gintama' matches multiple Gintama shows in the seed
    await page.goto('/search?q=gintama')
    const countEl = page.getByTestId('result-count')
    await expect(countEl).toBeVisible()
    await expect(countEl).toContainText(/shows? found/i)
    const count = await page.getByTestId('show-card').count()
    expect(count).toBeGreaterThan(1)
  })

  test('?q= nonsense query shows empty-state message', async ({ page }) => {
    await page.goto('/search?q=xyzzy__no_show_has_this_title__42')
    const countEl = page.getByTestId('result-count')
    await expect(countEl).toBeVisible()
    await expect(countEl).toContainText(/no shows match/i)
    // No show cards
    const count = await page.getByTestId('show-card').count()
    expect(count).toBe(0)
  })

  test('results heading reflects the search query', async ({ page }) => {
    await page.goto('/search?q=frieren')
    // The heading contains the quoted query
    await expect(page.getByRole('heading', { level: 1 })).toContainText('frieren')
  })

  // ---------------------------------------------------------------------------
  // Filter: genre via URL param
  // ---------------------------------------------------------------------------

  test('?genres=action filters to action shows only', async ({ page }) => {
    await page.goto('/search?genres=action')
    const countEl = page.getByTestId('result-count')
    await expect(countEl).toBeVisible()
    // Should show some results but fewer than the full catalog (narrowed).
    await expect(countEl).toContainText(/shows? found/i)
    const count = await page.getByTestId('show-card').count()
    expect(count).toBeGreaterThan(0)
    expect(count).toBeLessThan(SEED_TOTAL) // must have narrowed
  })

  // ---------------------------------------------------------------------------
  // Filter: audio via URL param
  // ---------------------------------------------------------------------------

  test('?audio=dub filters to dubbed shows', async ({ page }) => {
    await page.goto('/search?audio=dub')
    const countEl = page.getByTestId('result-count')
    await expect(countEl).toBeVisible()
    await expect(countEl).toContainText(/shows? found/i)
    const count = await page.getByTestId('show-card').count()
    // Seed-derived: dubbed shows are a strict subset of the catalog.
    expect(count).toBe(SEED_DUBBED)
    expect(count).toBeGreaterThan(0)
    expect(count).toBeLessThan(SEED_TOTAL)
  })

  test('?audio=sub filters to subbed shows (all seed shows are subbed)', async ({ page }) => {
    await page.goto('/search?audio=sub')
    const countEl = page.getByTestId('result-count')
    // Every seed show has sub episodes, so this equals the full subbed count.
    await expect(countEl).toContainText(
      new RegExp(`${SEED_SUBBED}\\s+shows? found`, 'i'),
    )
    const count = await page.getByTestId('show-card').count()
    expect(count).toBe(SEED_SUBBED)
  })

  // ---------------------------------------------------------------------------
  // Filter: status via URL param
  // ---------------------------------------------------------------------------

  test('?status=airing shows only airing shows (seed-derived count)', async ({ page }) => {
    await page.goto('/search?status=airing')
    const countEl = page.getByTestId('result-count')
    await expect(countEl).toBeVisible()
    // Count must equal the number of airing shows in the seed (currently 17).
    await expect(countEl).toContainText(
      new RegExp(`${SEED_AIRING}\\s+shows? found`, 'i'),
    )
    const count = await page.getByTestId('show-card').count()
    expect(count).toBe(SEED_AIRING)
    expect(count).toBeGreaterThan(0)
    expect(count).toBeLessThan(SEED_TOTAL)
  })

  // ---------------------------------------------------------------------------
  // FilterPanel interaction — genre toggle changes URL and grid
  // ---------------------------------------------------------------------------

  test('clicking a genre in FilterPanel updates the URL and narrows results', async ({ page }) => {
    await page.goto('/search')

    // Click the Action genre checkbox in the FilterPanel
    const filterPanel = page.getByTestId('filter-panel')
    const actionLabel = filterPanel.getByText('Action')
    await expect(actionLabel).toBeVisible()
    await actionLabel.click()

    // URL should now contain genres=action
    await page.waitForURL(/genres=action/)
    expect(page.url()).toContain('genres=action')

    // Results should be narrowed (fewer than the full catalog)
    const cards = page.getByTestId('show-card')
    const count = await cards.count()
    expect(count).toBeGreaterThan(0)
    expect(count).toBeLessThan(SEED_TOTAL)
  })

  test('clicking an audio filter changes URL and updates results', async ({ page }) => {
    await page.goto('/search')

    // Click the DUB audio radio
    const filterPanel = page.getByTestId('filter-panel')
    const dubLabel = filterPanel.getByText('DUB')
    await expect(dubLabel).toBeVisible()
    // Retry the click until the URL updates — guards against clicking before the
    // client FilterPanel has hydrated (the live-DB render widens that window).
    await expect(async () => {
      await dubLabel.click()
      await expect(page).toHaveURL(/audio=dub/, { timeout: 1500 })
    }).toPass({ timeout: 15000 })
    expect(page.url()).toContain('audio=dub')

    // Result count should be visible (audio=dub narrows the set).
    const countEl = page.getByTestId('result-count')
    await expect(countEl).toContainText(/shows? found/i)
  })

  // ---------------------------------------------------------------------------
  // Header search submits to /search?q=
  // ---------------------------------------------------------------------------

  test('typing in the header search-input and submitting lands on /search with results', async ({
    page,
  }) => {
    await page.goto('/')

    // Find the functional header search input (data-testid=search-input)
    // There may be two (desktop + mobile); use the first visible one.
    const searchInput = page.getByTestId('search-input').first()
    await expect(searchInput).toBeVisible()

    await searchInput.fill('frieren')
    await searchInput.press('Enter')

    // Should navigate to /search?q=frieren
    await page.waitForURL(/\/search\?q=/)
    expect(page.url()).toContain('/search')
    expect(page.url()).toContain('q=frieren')

    // Results should show at least 1 card
    await expect(page.getByTestId('show-card').first()).toBeVisible()
  })

  test('submitting empty header search navigates to bare /search', async ({ page }) => {
    await page.goto('/')
    const searchInput = page.getByTestId('search-input').first()
    await expect(searchInput).toBeVisible()

    // Submit with empty input
    await searchInput.press('Enter')
    await page.waitForURL(/\/search/)
    expect(page.url()).toContain('/search')
  })

  // ---------------------------------------------------------------------------
  // Clear filters
  // ---------------------------------------------------------------------------

  test('Clear button in FilterPanel resets filters and URL', async ({ page }) => {
    // Start with a filter active
    await page.goto('/search?audio=dub&sort=title')

    const clearBtn = page.getByRole('button', { name: /clear/i })
    await expect(clearBtn).toBeVisible()
    // Retry until hydrated (see note in the audio-filter test above).
    await expect(async () => {
      await clearBtn.click()
      await expect(page).toHaveURL(
        (url) => !url.search.includes('audio=') && !url.search.includes('sort='),
        { timeout: 1500 },
      )
    }).toPass({ timeout: 15000 })
    expect(page.url()).not.toContain('audio=')
    expect(page.url()).not.toContain('sort=')
  })
})

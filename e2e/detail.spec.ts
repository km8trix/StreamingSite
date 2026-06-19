import { expect, test } from '@playwright/test'

// M1 Slice 2 retired the owned in-app player. The show detail page is now a
// DISCOVERY surface: it leads with the legal "where to watch" path (an official
// embed when a provider is embeddable, plus out-links) and never hosts video.
// These e2e checks assert that contract against the live-seeded app.

test.describe('Show detail navigation', () => {
  test('clicking a show card lands on its detail page', async ({ page }) => {
    await page.goto('/')

    const firstCard = page.getByTestId('show-card').first()
    await expect(firstCard).toBeVisible()
    const slug = await firstCard.getAttribute('data-slug')
    expect(slug).toBeTruthy()

    await firstCard.click()
    await page.waitForURL(`**/shows/${slug}`)
    expect(page.url()).toContain(`/shows/${slug}`)

    // Detail page essentials.
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByTestId('badge-sub')).toBeVisible()
    await expect(page.getByTestId('badge-dub').first()).toBeVisible()
    await expect(page.getByTestId('episode-list')).toBeVisible()
    expect(await page.getByTestId('episode-row').count()).toBeGreaterThanOrEqual(1)
  })

  test('the watch section leads with the legal "where to watch" path and hosts no owned video', async ({
    page,
  }) => {
    await page.goto('/')
    const firstCard = page.getByTestId('show-card').first()
    const slug = await firstCard.getAttribute('data-slug')
    await page.goto(`/shows/${slug}`)

    // The watch hub renders, with the WhereToWatch panel always present.
    await expect(page.getByTestId('watch-section')).toBeVisible()
    await expect(page.getByTestId('where-to-watch')).toBeVisible()

    // It shows EITHER provider out-links OR the "no info yet" empty state — both
    // are valid (AniList availability is queried live and varies per title).
    await expect(
      page
        .getByTestId('where-to-watch-link')
        .first()
        .or(page.getByTestId('where-to-watch-empty')),
    ).toBeVisible()

    // The retired player must NOT appear: no owned <video>, no fake placeholder.
    await expect(page.getByTestId('video-player')).toHaveCount(0)
    await expect(page.getByTestId('player-placeholder')).toHaveCount(0)
    await expect(page.locator('video')).toHaveCount(0)

    // Any provider link is an external, safe out-link (never a hosted stream).
    const links = page.getByTestId('where-to-watch-link')
    for (let i = 0; i < (await links.count()); i++) {
      const href = await links.nth(i).getAttribute('href')
      expect(href).toMatch(/^https:\/\//)
      expect(href).not.toContain('test-streams.mux.dev')
      await expect(links.nth(i)).toHaveAttribute('target', '_blank')
      await expect(links.nth(i)).toHaveAttribute('rel', /noopener/)
    }
  })

  test('unknown slug renders the not-found page', async ({ page }) => {
    // As of M3, auth state is read server-side in the global header, so every
    // route renders dynamically. On a dynamic route Next renders the not-found
    // boundary (correct UX) but commits a 200 status, so we assert on the
    // user-facing not-found UI — the actual contract.
    await page.goto('/shows/does-not-exist')
    await expect(page.getByTestId('show-not-found')).toBeVisible()
    await expect(
      page.getByRole('heading', { name: /couldn.t find that show/i }),
    ).toBeVisible()
  })
})

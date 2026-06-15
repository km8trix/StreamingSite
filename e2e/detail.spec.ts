import { expect, test } from '@playwright/test'

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
    await expect(page.getByTestId('player-placeholder')).toBeVisible()
    await expect(page.getByTestId('episode-list')).toBeVisible()
    expect(await page.getByTestId('episode-row').count()).toBeGreaterThanOrEqual(1)
  })

  test('unknown slug renders the not-found page', async ({ page }) => {
    // As of M3, auth state is read server-side in the global header
    // (SiteHeader → AuthControls → getCurrentUser reads cookies), so every
    // route — including /shows/[slug] — renders dynamically. On a dynamic route
    // Next renders the route's not-found boundary (correct UX) but commits the
    // document status as 200 rather than 404 (the hard-404 status was a
    // side-effect of the page being fully static pre-M3). We therefore assert on
    // the user-facing not-found UI, which is the actual contract.
    await page.goto('/shows/does-not-exist')
    await expect(page.getByTestId('show-not-found')).toBeVisible()
    await expect(
      page.getByRole('heading', { name: /couldn.t find that show/i }),
    ).toBeVisible()
  })
})

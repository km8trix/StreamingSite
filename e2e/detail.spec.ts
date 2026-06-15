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

  test('unknown slug returns a 404', async ({ page }) => {
    const response = await page.goto('/shows/does-not-exist')
    expect(response?.status()).toBe(404)
  })
})

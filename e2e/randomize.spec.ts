import { expect, test } from '@playwright/test'

test.describe('Randomizer', () => {
  test('clicking Randomize navigates to a show detail page', async ({
    page,
  }) => {
    await page.goto('/')
    const button = page.getByTestId('randomize-button').first()
    await expect(button).toBeVisible()

    await button.click()
    await page.waitForURL(/\/shows\/.+/)
    expect(page.url()).toMatch(/\/shows\/.+/)

    // Confirm we actually landed on a real detail page. A random show may or
    // may not have a seeded stream, so accept either the real <VideoPlayer> or
    // the <PlayerPlaceholder> render path.
    await expect(page.getByTestId('watch-section')).toBeVisible()
    await expect(
      page.getByTestId('video-player').or(page.getByTestId('player-placeholder')),
    ).toBeVisible()
  })

  test('visiting /random redirects to a show detail page', async ({ page }) => {
    await page.goto('/random')
    await page.waitForURL(/\/shows\/.+/)
    expect(page.url()).toMatch(/\/shows\/.+/)
  })
})

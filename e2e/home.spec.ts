import { expect, test } from '@playwright/test'

test.describe('Home page', () => {
  test('loads and renders show cards', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/Senpai|Anime|Stream/i)

    const cards = page.getByTestId('show-card')
    await expect(cards.first()).toBeVisible()
    expect(await cards.count()).toBeGreaterThanOrEqual(1)
  })

  test('shows the three content rails / headings', async ({ page }) => {
    await page.goto('/')
    await expect(
      page.getByRole('heading', { name: 'Recently Updated' }),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Popular' }),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Recommended For You' }),
    ).toBeVisible()
  })
})

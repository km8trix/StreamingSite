import { expect, test } from '@playwright/test'

test.describe('News page (/news)', () => {
  test('renders the heading and a list of news cards', async ({ page }) => {
    await page.goto('/news')
    await expect(page).toHaveTitle(/news/i)
    await expect(
      page.getByRole('heading', { level: 1, name: 'News' }),
    ).toBeVisible()
    await expect(page.getByTestId('news-list')).toBeVisible()
    expect(await page.getByTestId('news-card').count()).toBeGreaterThan(0)
  })

  test('each card has a thumbnail and is a safe external link to its source', async ({
    page,
  }) => {
    await page.goto('/news')
    const first = page.getByTestId('news-card').first()
    await expect(first).toBeVisible()
    // Thumbnail (a real image, or the placeholder when none) is present.
    await expect(first.getByTestId('news-thumb')).toBeVisible()
    // Links OUT to the real source article, opened safely in a new tab.
    await expect(first).toHaveAttribute('href', /^https:\/\//)
    await expect(first).toHaveAttribute('target', '_blank')
    await expect(first).toHaveAttribute('rel', /noopener/)
  })

  test('the primary nav links to the news page', async ({ page }) => {
    await page.goto('/')
    await page
      .getByRole('navigation', { name: 'Primary' })
      .getByRole('link', { name: 'News' })
      .click()
    await page.waitForURL('**/news')
    await expect(
      page.getByRole('heading', { level: 1, name: 'News' }),
    ).toBeVisible()
  })
})

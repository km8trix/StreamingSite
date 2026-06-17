import { expect, test } from '@playwright/test'

test.describe('News page (/news)', () => {
  test('renders the heading and a list of news cards', async ({ page }) => {
    await page.goto('/news')
    await expect(page).toHaveTitle(/news/i)
    await expect(
      page.getByRole('heading', { level: 1, name: 'News' }),
    ).toBeVisible()
    expect(await page.getByTestId('news-card').count()).toBeGreaterThan(0)
  })

  test('shows a featured lead card', async ({ page }) => {
    await page.goto('/news')
    await expect(
      page.locator('[data-testid="news-card"][data-featured="true"]'),
    ).toBeVisible()
  })

  test('each card is a safe external link to its source', async ({ page }) => {
    await page.goto('/news')
    const first = page.getByTestId('news-card').first()
    await expect(first).toBeVisible()
    await expect(first).toHaveAttribute('href', /^https:\/\//)
    await expect(first).toHaveAttribute('target', '_blank')
    // rel must include noopener so the opened tab can't reach window.opener.
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

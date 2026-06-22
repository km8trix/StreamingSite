import { expect, test } from '@playwright/test'

// M0 — legal pages + cookie-consent gate.

test.describe('Legal pages', () => {
  for (const { path, heading, link } of [
    { path: '/terms', heading: /terms of service/i, link: 'Terms' },
    { path: '/privacy', heading: /privacy policy/i, link: 'Privacy' },
    { path: '/dmca', heading: /dmca policy/i, link: 'DMCA' },
  ]) {
    test(`${path} renders and is linked from the footer`, async ({ page }) => {
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        'href',
        new RegExp(`${path}$`),
      )
      // Footer links to it on every page (link label is short, e.g. "Terms").
      await expect(
        page.getByRole('contentinfo').getByRole('link', { name: link, exact: true }),
      ).toHaveCount(1)
    })
  }
})

test.describe('Cookie consent', () => {
  test('shows on first visit, Accept dismisses and persists across reload', async ({
    page,
  }) => {
    await page.goto('/')
    const banner = page.getByRole('region', { name: /cookie consent/i })
    await expect(banner).toBeVisible()

    await banner.getByRole('button', { name: /accept/i }).click()
    await expect(banner).toHaveCount(0)
    expect(await page.evaluate(() => localStorage.getItem('cookie-consent'))).toBe(
      'accepted',
    )

    await page.reload()
    await expect(page.getByRole('region', { name: /cookie consent/i })).toHaveCount(0)
  })

  test('Decline also dismisses and persists', async ({ page }) => {
    await page.goto('/')
    const banner = page.getByRole('region', { name: /cookie consent/i })
    await banner.getByRole('button', { name: /decline/i }).click()
    await expect(banner).toHaveCount(0)
    expect(await page.evaluate(() => localStorage.getItem('cookie-consent'))).toBe(
      'declined',
    )
  })
})

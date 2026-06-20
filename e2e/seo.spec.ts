import { expect, test } from '@playwright/test'

// M2 — SEO. robots.txt + sitemap.xml are served (Next file conventions) and the
// key pages expose a canonical link. Hosts in absolute URLs come from the
// canonical production origin, so we assert on path/suffix, not host.

test.describe('SEO', () => {
  test('robots.txt allows crawling and links the sitemap', async ({
    request,
  }) => {
    const res = await request.get('/robots.txt')
    expect(res.ok()).toBeTruthy()
    const body = await res.text()
    expect(body).toMatch(/User-Agent:\s*\*/i)
    expect(body).toMatch(/Allow:\s*\//i)
    expect(body).toMatch(/Disallow:\s*\/api\//i)
    expect(body).toMatch(/Sitemap:\s*https?:\/\/\S+\/sitemap\.xml/i)
  })

  test('sitemap.xml is valid XML listing show URLs', async ({ request }) => {
    const res = await request.get('/sitemap.xml')
    expect(res.ok()).toBeTruthy()
    expect(res.headers()['content-type']).toContain('xml')
    const body = await res.text()
    expect(body).toContain('<urlset')
    expect(body).toMatch(/<loc>https?:\/\/[^<]+\/shows\/[^<]+<\/loc>/)
  })

  test('home and show pages expose a canonical link', async ({ page }) => {
    await page.goto('/')
    const homeCanonical = page.locator('link[rel="canonical"]')
    await expect(homeCanonical).toHaveCount(1)
    // Root canonical is the site origin (Next renders it without a path,
    // optionally with a trailing slash). Host-agnostic: prod resolves the real
    // origin via VERCEL_PROJECT_PRODUCTION_URL; local resolves to localhost.
    await expect(homeCanonical).toHaveAttribute('href', /^https?:\/\/[^/]+\/?$/)

    const slug = await page
      .getByTestId('show-card')
      .first()
      .getAttribute('data-slug')
    await page.goto(`/shows/${slug}`)
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      new RegExp(`/shows/${slug}$`),
    )
  })
})

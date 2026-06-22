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

  // Each secondary surface canonicalizes onto its clean (query-string-free) URL.
  for (const path of ['/shows', '/schedule', '/news']) {
    test(`${path} canonicalizes onto its clean URL`, async ({ page }) => {
      await page.goto(`${path}?page=2&q=zzz`)
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        'href',
        new RegExp(`${path}$`),
      )
    })
  }

  test('genre page canonicalizes onto /genre/<slug>', async ({ page }) => {
    // Pull a real genre slug off the sitemap so the test isn't coupled to layout.
    const sitemap = await page.request.get('/sitemap.xml')
    const slug = (await sitemap.text()).match(/\/genre\/([^<]+)</)?.[1]
    test.skip(!slug, 'no genres seeded')
    await page.goto(`/genre/${slug}?page=2`)
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      new RegExp(`/genre/${slug}$`),
    )
  })

  test('serves a generated Open Graph image and references it', async ({
    page,
    request,
  }) => {
    const res = await request.get('/opengraph-image')
    expect(res.ok()).toBeTruthy()
    expect(res.headers()['content-type']).toContain('image/png')

    await page.goto('/')
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      'content',
      /\/opengraph-image/,
    )
  })

  test('home emits WebSite + SearchAction JSON-LD', async ({ page }) => {
    await page.goto('/')
    const json = await page
      .locator('script[type="application/ld+json"]')
      .first()
      .textContent()
    const data = JSON.parse(json ?? '{}')
    expect(data['@type']).toBe('WebSite')
    expect(data.potentialAction['@type']).toBe('SearchAction')
    expect(data.potentialAction.target.urlTemplate).toMatch(
      /\/shows\?q=\{search_term_string\}$/,
    )
  })

  test('show page emits BreadcrumbList JSON-LD', async ({ page }) => {
    await page.goto('/')
    const slug = await page
      .getByTestId('show-card')
      .first()
      .getAttribute('data-slug')
    await page.goto(`/shows/${slug}`)
    const blocks = await page
      .locator('script[type="application/ld+json"]')
      .allTextContents()
    const crumb = blocks
      .map((b) => JSON.parse(b))
      .find((d) => d['@type'] === 'BreadcrumbList')
    expect(crumb).toBeTruthy()
    expect(crumb.itemListElement).toHaveLength(3)
    expect(crumb.itemListElement[2].item).toMatch(new RegExp(`/shows/${slug}$`))
  })
})

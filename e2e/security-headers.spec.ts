import { expect, test } from '@playwright/test'

// M2 — production hardening. The app sends a Content-Security-Policy plus
// defense-in-depth headers on every response (next.config.ts). These checks
// assert the headers are present AND that the real pages (including the official
// YouTube embed + MyAnimeList images + AniList fetch) load without tripping CSP.

test.describe('Security headers', () => {
  test('document response carries the CSP + hardening headers', async ({
    page,
  }) => {
    const res = await page.goto('/')
    expect(res).toBeTruthy()
    const h = res!.headers()

    const csp = h['content-security-policy']
    expect(csp).toBeTruthy()
    expect(csp).toContain('frame-src https://www.youtube-nocookie.com')
    expect(csp).toContain('https://graphql.anilist.co')
    expect(csp).toContain('*.supabase.co')
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("frame-ancestors 'none'")

    expect(h['x-content-type-options']).toBe('nosniff')
    expect(h['x-frame-options']).toBe('DENY')
    expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin')
    expect(h['permissions-policy']).toContain('geolocation=()')
    expect(h['strict-transport-security']).toContain('max-age=')
  })

  test('home and a show page load with no CSP violations', async ({ page }) => {
    // A real CSP violation always names "Content Security Policy" in the console
    // message ("Refused to … because it violates the following Content Security
    // Policy directive: …"). We match that precisely so we don't flag unrelated
    // artifacts — e.g. nosniff refusing the Vercel Analytics script, which 404s
    // to HTML in local `next start` (it's only served on Vercel's edge in prod).
    const violations: string[] = []
    page.on('console', (msg) => {
      if (/content security policy/i.test(msg.text())) violations.push(msg.text())
    })

    await page.goto('/')
    const slug = await page
      .getByTestId('show-card')
      .first()
      .getAttribute('data-slug')

    await page.goto(`/shows/${slug}`)
    await expect(page.getByTestId('watch-section')).toBeVisible()
    // Give late subresources (optimized images, any embed) a beat to trip CSP
    // if a directive were misconfigured.
    await page.waitForTimeout(700)

    expect(violations, violations.join('\n')).toEqual([])
  })
})

import { expect, test } from '@playwright/test'
import seed from '../src/lib/data/seed.json'

// Derive representative shows from the live seed (the e2e runs against live
// Supabase, which is seeded from this same data) so the assertions stay correct
// if the seed evolves.
type SeedEpisode = { number: number; videoUrl: string | null }
type SeedShow = { slug: string; episodes: SeedEpisode[] }
const SHOWS = seed.shows as SeedShow[]

// A multi-episode show whose lowest-numbered episode HAS a seeded stream and
// which also has at least one later episode WITHOUT one — exercises both the
// real <VideoPlayer> and the <PlayerPlaceholder> on a single page.
const MIXED = SHOWS.find(
  (s) =>
    s.episodes.length > 1 &&
    s.episodes.some((e) => e.videoUrl) &&
    s.episodes.some((e) => !e.videoUrl),
)!
const MIXED_FIRST = [...MIXED.episodes].sort((a, b) => a.number - b.number)[0]
const MIXED_NULL_EP = MIXED.episodes.find((e) => !e.videoUrl)!

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
    // The watch experience renders the real <VideoPlayer> when the active
    // episode has a stream, otherwise the <PlayerPlaceholder>. Assert the
    // section is present and that one of the two render paths is visible.
    await expect(page.getByTestId('watch-section')).toBeVisible()
    await expect(
      page.getByTestId('video-player').or(page.getByTestId('player-placeholder')),
    ).toBeVisible()
    await expect(page.getByTestId('episode-list')).toBeVisible()
    expect(await page.getByTestId('episode-row').count()).toBeGreaterThanOrEqual(1)
  })

  test('episode 1 mounts the real video player wired to the HLS manifest; a sourceless episode shows the placeholder', async ({
    page,
  }) => {
    await page.goto(`/shows/${MIXED.slug}`)

    // WatchSection is a client component — wait for it to mount.
    await expect(page.getByTestId('watch-section')).toBeVisible()

    // Default active episode = the first one with a stream → the real player
    // (a <video> element) renders, NOT the placeholder.
    const player = page.getByTestId('video-player')
    await expect(player).toBeVisible()
    await expect(page.getByTestId('player-placeholder')).toHaveCount(0)

    // It is a genuine <video> element.
    await expect(player.locator('video')).toHaveCount(1)

    // It is wired to the HLS manifest: the player carries the .m3u8 URL (the
    // no-JS fallback anchor inside <video> always reflects the source; on the
    // native-HLS path it is also set as video.src). Assert the manifest URL is
    // present in the player.
    const manifest = MIXED_FIRST.videoUrl as string
    expect(manifest).toMatch(/\.m3u8$/)
    await expect(player.locator(`a[href="${manifest}"]`)).toHaveCount(1)

    // Now pick an episode that has NO source (data-has-video="false") → the
    // player is replaced by the "streaming coming soon" placeholder (the UI must
    // not render a broken player). There is at least one such episode by
    // construction (MIXED_NULL_EP).
    expect(MIXED_NULL_EP).toBeTruthy()
    const sourcelessButton = page.locator(
      '[data-testid="episode-select-option"][data-has-video="false"]',
    )
    await sourcelessButton.first().click()

    await expect(page.getByTestId('player-placeholder')).toBeVisible()
    await expect(page.getByTestId('video-player')).toHaveCount(0)
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

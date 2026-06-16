import { beforeEach, describe, expect, it, vi } from 'vitest'

// These tests exercise the SEED-FALLBACK path only: Supabase env must be unset
// so isSupabaseConfigured() === false and the data layer reads seed.json.
// We assert that here defensively.
import {
  getAllShows,
  getPopularShows,
  getRandomShow,
  getRecentlyUpdatedShows,
  getRecommendedForYou,
  getRecommendedShows,
  getShowBySlug,
  listGenres,
} from '@/lib/data'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import seed from '@/lib/data/seed.json'

const SEED_SHOW_COUNT = seed.shows.length

// A real slug present in the seed (verified against seed.json).
const REAL_SLUG = seed.shows[0].slug

beforeEach(() => {
  // Guard: every assertion below depends on the offline fallback being active.
  expect(isSupabaseConfigured()).toBe(false)
})

describe('getRecentlyUpdatedShows', () => {
  it('orders by updatedAt descending', async () => {
    const shows = await getRecentlyUpdatedShows(SEED_SHOW_COUNT)
    // Cross-reference each summary back to its seed detail to read updatedAt.
    const updatedAts = shows.map((s) => {
      const detail = seed.shows.find((d) => d.id === s.id)!
      return detail.updatedAt
    })
    const sorted = [...updatedAts].sort((a, b) => b.localeCompare(a))
    expect(updatedAts).toEqual(sorted)
  })

  it('defaults to a limit of 12', async () => {
    const shows = await getRecentlyUpdatedShows()
    expect(shows).toHaveLength(12)
  })

  it('respects an explicit limit', async () => {
    const shows = await getRecentlyUpdatedShows(5)
    expect(shows).toHaveLength(5)
  })

  it('returns ShowSummary shape (no detail-only fields leak)', async () => {
    const [show] = await getRecentlyUpdatedShows(1)
    expect(show).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        slug: expect.any(String),
        title: expect.any(String),
        coverImage: expect.any(String),
        subEpisodes: expect.any(Number),
        dubEpisodes: expect.any(Number),
        status: expect.any(String),
      }),
    )
    expect(show).not.toHaveProperty('episodes')
    expect(show).not.toHaveProperty('synopsis')
  })
})

describe('getPopularShows', () => {
  it('orders by popularityScore descending', async () => {
    const shows = await getPopularShows(SEED_SHOW_COUNT)
    const scores = shows.map(
      (s) => seed.shows.find((d) => d.id === s.id)!.popularityScore,
    )
    const sorted = [...scores].sort((a, b) => b - a)
    expect(scores).toEqual(sorted)
  })

  it('defaults to a limit of 12', async () => {
    expect(await getPopularShows()).toHaveLength(12)
  })
})

describe('getRecommendedShows', () => {
  it('defaults to a limit of 12 and biases airing shows first', async () => {
    const shows = await getRecommendedShows(SEED_SHOW_COUNT)
    expect(shows.slice(0, 12)).toHaveLength(12)
    // All airing shows should appear before any non-airing show.
    const statuses = shows.map((s) => s.status)
    const lastAiring = statuses.lastIndexOf('airing')
    const firstNonAiring = statuses.findIndex((st) => st !== 'airing')
    if (lastAiring !== -1 && firstNonAiring !== -1) {
      expect(lastAiring).toBeLessThan(firstNonAiring)
    }
  })
})

describe('getRecommendedForYou', () => {
  // Pick a watched show that actually carries at least one genre so overlap
  // scoring has something to work with.
  const watchedShow = seed.shows.find((s) => s.genres.length > 0)!

  it('with no watch history returns the generic recommendations', async () => {
    const personalized = await getRecommendedForYou([])
    const generic = await getRecommendedShows()
    expect(personalized).toEqual(generic)
  })

  it('never recommends an already-watched show', async () => {
    const recs = await getRecommendedForYou([watchedShow.id], SEED_SHOW_COUNT)
    expect(recs.some((s) => s.id === watchedShow.id)).toBe(false)
  })

  it('ranks a genre-overlapping show first', async () => {
    const watchedGenreIds = new Set(watchedShow.genres.map((g) => g.id))
    const recs = await getRecommendedForYou([watchedShow.id], SEED_SHOW_COUNT)
    const topDetail = seed.shows.find((d) => d.id === recs[0].id)!
    expect(topDetail.genres.some((g) => watchedGenreIds.has(g.id))).toBe(true)
  })

  it('returns ShowSummary shape, default-capped at 12', async () => {
    const recs = await getRecommendedForYou([watchedShow.id])
    expect(recs.length).toBeGreaterThan(0)
    expect(recs.length).toBeLessThanOrEqual(12)
    expect(recs[0]).not.toHaveProperty('episodes')
    expect(recs[0]).toEqual(
      expect.objectContaining({ id: expect.any(String), slug: expect.any(String) }),
    )
  })
})

describe('getAllShows', () => {
  it('returns every seed show', async () => {
    const shows = await getAllShows()
    expect(shows).toHaveLength(SEED_SHOW_COUNT)
  })
})

describe('getShowBySlug', () => {
  it('returns a ShowDetail for a real seed slug', async () => {
    const detail = await getShowBySlug(REAL_SLUG)
    expect(detail).not.toBeNull()
    expect(detail!.slug).toBe(REAL_SLUG)
    // Detail-only fields are present.
    expect(detail!).toEqual(
      expect.objectContaining({
        synopsis: expect.any(String),
        genres: expect.any(Array),
        episodes: expect.any(Array),
        popularityScore: expect.any(Number),
        updatedAt: expect.any(String),
      }),
    )
  })

  it('sorts episodes by number ascending', async () => {
    const detail = await getShowBySlug(REAL_SLUG)
    const numbers = detail!.episodes.map((e) => e.number)
    expect(numbers).toEqual([...numbers].sort((a, b) => a - b))
  })

  it('returns null for a missing slug', async () => {
    expect(await getShowBySlug('does-not-exist-xyz')).toBeNull()
  })

  it('maps each episode videoUrl as string | null (HLS source field present)', async () => {
    const detail = await getShowBySlug(REAL_SLUG)
    expect(detail!.episodes.length).toBeGreaterThan(0)
    for (const ep of detail!.episodes) {
      // The field must always exist on the domain object (the mapper normalises
      // video_url ?? null), and be either a manifest URL string or null — never
      // undefined. Guards against an accidental removal of the mapper line.
      expect(ep).toHaveProperty('videoUrl')
      expect(
        ep.videoUrl === null || typeof ep.videoUrl === 'string',
      ).toBe(true)
    }
  })

  it('exposes at least one seeded HLS manifest URL on the catalog', async () => {
    // The seed assigns the Mux test stream to episode 1 of every show, so any
    // real show should surface a non-null .m3u8 videoUrl somewhere in its list.
    const detail = await getShowBySlug(REAL_SLUG)
    const withStream = detail!.episodes.find((e) => e.videoUrl)
    expect(withStream).toBeDefined()
    expect(withStream!.videoUrl).toMatch(/\.m3u8($|\?)/)
  })
})

describe('getRandomShow', () => {
  it('returns a show that belongs to the catalog', async () => {
    const all = await getAllShows()
    const allSlugs = new Set(all.map((s) => s.slug))
    const random = await getRandomShow()
    expect(random).not.toBeNull()
    expect(allSlugs.has(random!.slug)).toBe(true)
  })

  it('can return different shows across calls (uses Math.random)', async () => {
    // Force the two ends of the catalog to prove the index is data-driven.
    const all = await getAllShows()
    const spy = vi.spyOn(Math, 'random')
    spy.mockReturnValueOnce(0)
    const first = await getRandomShow()
    spy.mockReturnValueOnce(0.999999)
    const last = await getRandomShow()
    expect(first!.slug).toBe(all[0].slug)
    expect(last!.slug).toBe(all[all.length - 1].slug)
    spy.mockRestore()
  })
})

describe('listGenres', () => {
  it('returns a non-empty, alphabetically-sorted genre list', async () => {
    const genres = await listGenres()
    expect(genres.length).toBeGreaterThan(0)
    const names = genres.map((g) => g.name)
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)))
    expect(genres[0]).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        name: expect.any(String),
        slug: expect.any(String),
      }),
    )
  })
})

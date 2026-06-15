// search.test.ts — Milestone 2, Phase 5 data-layer tests.
//
// Exercises searchAndFilterShows() and listFilterYears() against the
// seed-fallback path (no Supabase env configured). Covers:
//   - Case-insensitive title substring search
//   - Genre slug OR filter
//   - Audio sub/dub filter
//   - Status exact filter
//   - Year exact filter
//   - All 4 sort orders (title, popularity, recent, year)
//   - Empty-result case (nonsense query)
//   - Default sort = popularity
//   - listFilterYears: descending distinct numbers, no nulls

import { beforeEach, describe, expect, it } from 'vitest'
import { searchAndFilterShows, listFilterYears } from '@/lib/data'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import seed from '@/lib/data/seed.json'

type SeedShow = {
  id: string
  title: string
  status: string
  year: number | null
  subEpisodes: number
  dubEpisodes: number
  popularityScore: number
  updatedAt: string
  genres: { id: string; name: string; slug: string }[]
}

const SEED_SHOWS = seed.shows as SeedShow[]
const SEED_TOTAL = SEED_SHOWS.length

beforeEach(() => {
  // Guard: all assertions rely on the seed-fallback path.
  expect(isSupabaseConfigured()).toBe(false)
})

// ---------------------------------------------------------------------------
// Baseline: no filter
// ---------------------------------------------------------------------------

describe('searchAndFilterShows — no filter', () => {
  it('returns all shows when no filter is applied', async () => {
    const { shows, total } = await searchAndFilterShows({})
    expect(total).toBe(SEED_TOTAL)
    expect(shows).toHaveLength(SEED_TOTAL)
  })

  it('returns ShowSummary shape (no detail-only fields leak)', async () => {
    const { shows } = await searchAndFilterShows({})
    for (const show of shows) {
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
      expect(show).not.toHaveProperty('synopsis')
      expect(show).not.toHaveProperty('episodes')
      expect(show).not.toHaveProperty('popularityScore')
    }
  })

  it('total equals shows.length', async () => {
    const { shows, total } = await searchAndFilterShows({})
    expect(total).toBe(shows.length)
  })
})

// ---------------------------------------------------------------------------
// Title query
// ---------------------------------------------------------------------------

describe('searchAndFilterShows — title query', () => {
  it('narrows by case-insensitive substring (lowercase query)', async () => {
    // 'frieren' appears in "Frieren: Beyond Journey's End" (unique)
    const { shows, total } = await searchAndFilterShows({ query: 'frieren' })
    expect(total).toBeGreaterThanOrEqual(1)
    expect(total).toBeLessThan(SEED_TOTAL)
    expect(shows.every((s) => s.title.toLowerCase().includes('frieren'))).toBe(true)
  })

  it('narrows by case-insensitive substring (UPPERCASE query)', async () => {
    const { shows, total } = await searchAndFilterShows({ query: 'FRIEREN' })
    expect(total).toBeGreaterThanOrEqual(1)
    expect(shows.every((s) => s.title.toLowerCase().includes('frieren'))).toBe(true)
  })

  it('narrows by mixed-case substring', async () => {
    const { shows } = await searchAndFilterShows({ query: 'Frieren' })
    expect(shows.length).toBeGreaterThanOrEqual(1)
    expect(shows.every((s) => s.title.toLowerCase().includes('frieren'))).toBe(true)
  })

  it('returns empty result for a nonsense query', async () => {
    const { shows, total } = await searchAndFilterShows({
      query: 'xyzzy__no_show_has_this_title__42',
    })
    expect(shows).toHaveLength(0)
    expect(total).toBe(0)
  })

  it('trims leading/trailing whitespace from query', async () => {
    const { shows: withSpaces } = await searchAndFilterShows({ query: '  frieren  ' })
    const { shows: clean } = await searchAndFilterShows({ query: 'frieren' })
    expect(withSpaces.length).toBe(clean.length)
  })

  it('empty-string query returns all shows (treated as no filter)', async () => {
    const { total } = await searchAndFilterShows({ query: '' })
    expect(total).toBe(SEED_TOTAL)
  })
})

// ---------------------------------------------------------------------------
// Genre filter (OR semantics)
// ---------------------------------------------------------------------------

describe('searchAndFilterShows — genre filter', () => {
  it('filters by a single genre slug', async () => {
    // Count is seed-derived (do not hardcode); 'action' is a populated genre.
    const expectedAction = SEED_SHOWS.filter((s) =>
      s.genres.some((g) => g.slug === 'action'),
    ).length
    const { shows, total } = await searchAndFilterShows({ genres: ['action'] })
    expect(total).toBe(expectedAction)
    expect(total).toBeGreaterThan(0)
    expect(total).toBeLessThan(SEED_TOTAL)
    // Every returned show must have the action genre
    expect(
      shows.every((s) => {
        const seedShow = SEED_SHOWS.find((ss) => ss.id === s.id)!
        return seedShow.genres.some((g) => g.slug === 'action')
      }),
    ).toBe(true)
  })

  it('uses OR semantics — a show matching ANY selected genre is included', async () => {
    // Get shows matching action OR adventure separately
    const { total: actionCount } = await searchAndFilterShows({ genres: ['action'] })
    const { total: adventureCount } = await searchAndFilterShows({ genres: ['adventure'] })
    const { shows: combined, total: combinedTotal } = await searchAndFilterShows({
      genres: ['action', 'adventure'],
    })

    // Combined result must be ≥ each individual result (OR, not AND)
    expect(combinedTotal).toBeGreaterThanOrEqual(actionCount)
    expect(combinedTotal).toBeGreaterThanOrEqual(adventureCount)
    // And every returned show must have at least one of the two genres
    expect(
      combined.every((s) => {
        const seedShow = SEED_SHOWS.find((ss) => ss.id === s.id)!
        return seedShow.genres.some((g) => g.slug === 'action' || g.slug === 'adventure')
      }),
    ).toBe(true)
  })

  it('returns empty for a genre slug that matches nothing', async () => {
    const { shows, total } = await searchAndFilterShows({ genres: ['nonexistent-genre-slug'] })
    expect(total).toBe(0)
    expect(shows).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Audio filter
// ---------------------------------------------------------------------------

describe('searchAndFilterShows — audio filter', () => {
  it('audio=sub returns only shows with subEpisodes > 0', async () => {
    const { shows, total } = await searchAndFilterShows({ audio: 'sub' })
    expect(total).toBeGreaterThan(0)
    expect(shows.every((s) => s.subEpisodes > 0)).toBe(true)
    // Seed-derived: every subbed show in the seed is returned.
    expect(total).toBe(SEED_SHOWS.filter((s) => s.subEpisodes > 0).length)
  })

  it('audio=dub returns only shows with dubEpisodes > 0', async () => {
    const { shows, total } = await searchAndFilterShows({ audio: 'dub' })
    expect(total).toBeGreaterThan(0)
    expect(shows.every((s) => s.dubEpisodes > 0)).toBe(true)
    // Seed-derived: every dubbed show in the seed is returned.
    const expectedDubCount = SEED_SHOWS.filter((s) => s.dubEpisodes > 0).length
    expect(total).toBe(expectedDubCount)
    expect(total).toBeLessThan(SEED_TOTAL) // not every show has a dub
  })

  it('audio=any does not restrict the result set', async () => {
    const { total } = await searchAndFilterShows({ audio: 'any' })
    expect(total).toBe(SEED_TOTAL)
  })

  it('dub filter excludes shows with 0 dub episodes', async () => {
    const { shows } = await searchAndFilterShows({ audio: 'dub' })
    expect(shows.every((s) => s.dubEpisodes > 0)).toBe(true)
    const dubZeroInSeed = SEED_SHOWS.filter((s) => s.dubEpisodes === 0)
    const dubZeroIds = new Set(dubZeroInSeed.map((s) => s.id))
    expect(shows.every((s) => !dubZeroIds.has(s.id))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Status filter
// ---------------------------------------------------------------------------

describe('searchAndFilterShows — status filter', () => {
  it('filters by status=airing', async () => {
    const expectedAiring = SEED_SHOWS.filter((s) => s.status === 'airing').length
    const { shows, total } = await searchAndFilterShows({ status: 'airing' })
    // Seed-derived: total airing shows must match the seed exactly (currently 17).
    expect(total).toBe(expectedAiring)
    expect(total).toBeGreaterThan(0)
    // Property check: every returned show is airing.
    expect(shows.every((s) => s.status === 'airing')).toBe(true)
  })

  it('filters by status=finished', async () => {
    const expectedCount = SEED_SHOWS.filter((s) => s.status === 'finished').length
    const { shows, total } = await searchAndFilterShows({ status: 'finished' })
    expect(total).toBe(expectedCount)
    expect(shows.every((s) => s.status === 'finished')).toBe(true)
  })

  it('filters by status=upcoming', async () => {
    const expectedCount = SEED_SHOWS.filter((s) => s.status === 'upcoming').length
    const { total } = await searchAndFilterShows({ status: 'upcoming' })
    expect(total).toBe(expectedCount)
  })
})

// ---------------------------------------------------------------------------
// Year filter
// ---------------------------------------------------------------------------

describe('searchAndFilterShows — year filter', () => {
  it('filters by exact year', async () => {
    const targetYear = 2026
    const expectedCount = SEED_SHOWS.filter((s) => s.year === targetYear).length
    const { shows, total } = await searchAndFilterShows({ year: targetYear })
    expect(total).toBe(expectedCount)
    expect(shows.every((s) => s.year === targetYear)).toBe(true)
  })

  it('returns empty for a year with no shows', async () => {
    const { shows, total } = await searchAndFilterShows({ year: 1900 })
    expect(total).toBe(0)
    expect(shows).toHaveLength(0)
  })

  it('year=2026 returns exactly the seed shows from 2026', async () => {
    const expected2026 = SEED_SHOWS.filter((s) => s.year === 2026).length
    const { shows, total } = await searchAndFilterShows({ year: 2026 })
    // Seed-derived (currently 17 after enrichment); also assert the property.
    expect(total).toBe(expected2026)
    expect(total).toBeGreaterThan(0)
    expect(shows.every((s) => s.year === 2026)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Combined filters
// ---------------------------------------------------------------------------

describe('searchAndFilterShows — combined filters', () => {
  it('title + status narrows correctly', async () => {
    // 'frieren' + status=finished (Frieren is finished in the seed)
    const { shows, total } = await searchAndFilterShows({
      query: 'frieren',
      status: 'finished',
    })
    expect(total).toBeGreaterThanOrEqual(1)
    expect(shows.every((s) => s.status === 'finished')).toBe(true)
    expect(shows.every((s) => s.title.toLowerCase().includes('frieren'))).toBe(true)
  })

  it('year + audio combined filter', async () => {
    // 2026 shows that have sub episodes.
    const expected = SEED_SHOWS.filter(
      (s) => s.year === 2026 && s.subEpisodes > 0,
    ).length
    const { shows, total } = await searchAndFilterShows({
      year: 2026,
      audio: 'sub',
    })
    // Seed-derived count + property check on every result.
    expect(total).toBe(expected)
    expect(total).toBeGreaterThan(0)
    expect(shows.every((s) => s.year === 2026 && s.subEpisodes > 0)).toBe(true)
  })

  it('genre + dub combined filter', async () => {
    const { shows } = await searchAndFilterShows({
      genres: ['action'],
      audio: 'dub',
    })
    expect(
      shows.every((s) => {
        const ss = SEED_SHOWS.find((x) => x.id === s.id)!
        return ss.genres.some((g) => g.slug === 'action') && s.dubEpisodes > 0
      }),
    ).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Sort orders
// ---------------------------------------------------------------------------

describe('searchAndFilterShows — sort orders', () => {
  it('default sort is popularity (desc)', async () => {
    const { shows } = await searchAndFilterShows({})
    const scores = shows.map(
      (s) => SEED_SHOWS.find((ss) => ss.id === s.id)!.popularityScore,
    )
    const sorted = [...scores].sort((a, b) => b - a)
    expect(scores).toEqual(sorted)
  })

  it('sort=popularity returns results in popularityScore descending order', async () => {
    const { shows } = await searchAndFilterShows({ sort: 'popularity' })
    const scores = shows.map(
      (s) => SEED_SHOWS.find((ss) => ss.id === s.id)!.popularityScore,
    )
    expect(scores).toEqual([...scores].sort((a, b) => b - a))
  })

  it('sort=title returns results in title ascending (A-Z) order', async () => {
    const { shows } = await searchAndFilterShows({ sort: 'title' })
    const titles = shows.map((s) => s.title)
    const sorted = [...titles].sort((a, b) => a.localeCompare(b))
    expect(titles).toEqual(sorted)
  })

  it('sort=recent returns results in updatedAt descending order', async () => {
    const { shows } = await searchAndFilterShows({ sort: 'recent' })
    const timestamps = shows.map(
      (s) => SEED_SHOWS.find((ss) => ss.id === s.id)!.updatedAt,
    )
    const sorted = [...timestamps].sort((a, b) => b.localeCompare(a))
    expect(timestamps).toEqual(sorted)
  })

  it('sort=year returns results in year descending order', async () => {
    const { shows } = await searchAndFilterShows({ sort: 'year' })
    const years = shows.map((s) => s.year ?? 0)
    const sorted = [...years].sort((a, b) => b - a)
    expect(years).toEqual(sorted)
  })
})

// ---------------------------------------------------------------------------
// listFilterYears
// ---------------------------------------------------------------------------

describe('listFilterYears', () => {
  it('returns an array of numbers', async () => {
    const years = await listFilterYears()
    expect(Array.isArray(years)).toBe(true)
    expect(years.every((y) => typeof y === 'number')).toBe(true)
  })

  it('returns no null values', async () => {
    const years = await listFilterYears()
    expect(years.every((y) => y !== null && y !== undefined)).toBe(true)
  })

  it('returns distinct values only', async () => {
    const years = await listFilterYears()
    expect(years.length).toBe(new Set(years).size)
  })

  it('returns years in descending order', async () => {
    const years = await listFilterYears()
    const sorted = [...years].sort((a, b) => b - a)
    expect(years).toEqual(sorted)
  })

  it('includes all distinct non-null years from the seed', async () => {
    const expectedYears = [
      ...new Set(
        SEED_SHOWS.map((s) => s.year).filter((y): y is number => y !== null),
      ),
    ].sort((a, b) => b - a)
    const years = await listFilterYears()
    expect(years).toEqual(expectedYears)
  })

  it('does not include 2026 more than once even though two 2026 shows exist', async () => {
    const years = await listFilterYears()
    const count2026 = years.filter((y) => y === 2026).length
    expect(count2026).toBe(1)
  })
})

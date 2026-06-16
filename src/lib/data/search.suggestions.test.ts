// search.suggestions.test.ts — Roadmap: SEARCH TYPEAHEAD data-layer tests.
//
// Exercises getSearchSuggestions() from src/lib/data/search.ts. Covers BOTH
// branches the data layer has:
//   - SEED-FALLBACK (Supabase not configured): matches by title (case-insensitive
//     substring), returns [] for <2-char / blank queries (no client built),
//     respects the `limit`, ranks starts-with before contains, and returns the
//     LIGHT typeahead payload shape ({slug,title,coverImage,year} only — no
//     subEpisodes/status/synopsis/popularity leak).
//   - RESILIENCE (Supabase configured but the live query errors): the live branch
//     is wrapped in try/catch -> console.warn + seed fallback; the fn NEVER throws
//     (the resilience contract, exactly like searchAndFilterShows/listFilterYears).
//
// isSupabaseConfigured() and the Supabase PUBLIC client are mocked so no live DB
// is required (mirrors src/lib/data/ads.test.ts).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Mock the config gate so isSupabaseConfigured() is controllable per-test.
// ---------------------------------------------------------------------------
const isConfiguredMock = vi.fn(() => false)
vi.mock('@/lib/supabase/config', () => ({
  isSupabaseConfigured: () => isConfiguredMock(),
}))

// ---------------------------------------------------------------------------
// Fake Supabase PUBLIC client.
//
// getSearchSuggestions (live path) issues:
//   from('shows')
//     .select('slug, title, cover_image, year, popularity_score')
//     .ilike('title', pattern)
//     .order('popularity_score', { ascending: false })
//     .limit(cap * 3)            <- awaited here
//
// The builder is a thenable so the awaited end of the chain resolves to the
// installed response, while intermediate calls keep chaining.
// ---------------------------------------------------------------------------
type Resp = { data?: unknown; error?: unknown }

let installed: { select?: Resp } = {}

const calls = {
  from: [] as string[],
  select: [] as string[],
  ilike: [] as Array<[string, string]>,
  order: [] as Array<[string, unknown]>,
  limit: [] as number[],
}

function makeFakeClient() {
  function showsBuilder() {
    const builder: Record<string, unknown> = {}
    const resolve = () => installed.select ?? { data: [], error: null }
    builder.select = (cols: string) => {
      calls.select.push(cols)
      return builder
    }
    builder.ilike = (col: string, pattern: string) => {
      calls.ilike.push([col, pattern])
      return builder
    }
    builder.order = (col: string, opts: unknown) => {
      calls.order.push([col, opts])
      return builder
    }
    builder.limit = (n: number) => {
      calls.limit.push(n)
      return builder
    }
    // Thenable: awaiting the chain resolves to the installed response.
    builder.then = (onFulfilled: (v: Resp) => unknown) =>
      Promise.resolve(resolve()).then(onFulfilled)
    return builder
  }

  return {
    from(table: string) {
      calls.from.push(table)
      return showsBuilder()
    },
  }
}

const getPublicClientMock = vi.fn(async () => makeFakeClient())
vi.mock('@/lib/supabase/server', () => ({
  getPublicClient: () => getPublicClientMock(),
}))

import { getSearchSuggestions } from '@/lib/data'
import seed from '@/lib/data/seed.json'

type SeedShow = {
  slug: string
  title: string
  coverImage: string
  year: number | null
  popularityScore: number
}
const SEED_SHOWS = seed.shows as SeedShow[]

// A raw shows row as the live select returns (snake_case, only the columns
// getSearchSuggestions asks for).
function rawShow(overrides: Partial<{
  slug: string
  title: string
  cover_image: string
  year: number | null
  popularity_score: number
}> = {}) {
  return {
    slug: 'frieren-beyond-journeys-end',
    title: "Frieren: Beyond Journey's End",
    cover_image: 'https://cdn.myanimelist.net/images/frieren.jpg',
    year: 2023,
    popularity_score: 100,
    ...overrides,
  }
}

beforeEach(() => {
  isConfiguredMock.mockReturnValue(false)
  installed = {}
  calls.from = []
  calls.select = []
  calls.ilike = []
  calls.order = []
  calls.limit = []
  getPublicClientMock.mockClear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ===========================================================================
// SEED-FALLBACK — short / blank queries return [] without touching the DB
// ===========================================================================

describe('getSearchSuggestions — short / blank query', () => {
  it('returns [] for an empty query (no client built)', async () => {
    expect(await getSearchSuggestions('')).toEqual([])
    expect(getPublicClientMock).not.toHaveBeenCalled()
  })

  it('returns [] for a 1-char query (below the 2-char minimum)', async () => {
    expect(await getSearchSuggestions('f')).toEqual([])
    expect(getPublicClientMock).not.toHaveBeenCalled()
  })

  it('returns [] for a whitespace-only query', async () => {
    expect(await getSearchSuggestions('   ')).toEqual([])
    expect(getPublicClientMock).not.toHaveBeenCalled()
  })

  it('returns [] when a query trims to under 2 chars', async () => {
    expect(await getSearchSuggestions('  a  ')).toEqual([])
    expect(getPublicClientMock).not.toHaveBeenCalled()
  })

  it('starts matching at exactly 2 chars', async () => {
    const res = await getSearchSuggestions('fr')
    expect(res.length).toBeGreaterThan(0)
  })
})

// ===========================================================================
// SEED-FALLBACK — title matching
// ===========================================================================

describe('getSearchSuggestions — seed fallback title match', () => {
  it('matches by case-insensitive title substring', async () => {
    const lower = await getSearchSuggestions('frieren')
    const upper = await getSearchSuggestions('FRIEREN')
    const mixed = await getSearchSuggestions('FrIeReN')
    expect(lower.length).toBeGreaterThanOrEqual(1)
    expect(lower.every((s) => s.title.toLowerCase().includes('frieren'))).toBe(true)
    // Case does not change the result set.
    expect(upper.map((s) => s.slug)).toEqual(lower.map((s) => s.slug))
    expect(mixed.map((s) => s.slug)).toEqual(lower.map((s) => s.slug))
  })

  it('finds the known Frieren seed show and ranks it first (starts-with)', async () => {
    const res = await getSearchSuggestions('fr')
    expect(res.length).toBeGreaterThanOrEqual(1)
    // "Frieren…" / "Fruits Basket…" start with 'fr' so a starts-with title leads.
    expect(res[0].title.toLowerCase().startsWith('fr')).toBe(true)
    expect(res.some((s) => s.slug === 'frieren-beyond-journeys-end')).toBe(true)
  })

  it('ranks starts-with matches ahead of contains-only matches', async () => {
    // 'fr' starts "Frieren"/"Fruits Basket" but only appears mid-title in others
    // (e.g. "…with the Second Prettiest Girl…" -> no; but enrichment shows do).
    const res = await getSearchSuggestions('fr')
    const startsFlags = res.map((s) => s.title.toLowerCase().startsWith('fr'))
    // Once we hit the first non-starts-with, no later item may start-with again.
    const firstContainsOnly = startsFlags.indexOf(false)
    if (firstContainsOnly !== -1) {
      expect(startsFlags.slice(firstContainsOnly).some(Boolean)).toBe(false)
    }
  })

  it('returns [] for a query no title contains', async () => {
    expect(await getSearchSuggestions('xyzzy__no_show__42')).toEqual([])
  })

  it('does not build a Supabase client on the seed-fallback path', async () => {
    await getSearchSuggestions('fr')
    expect(getPublicClientMock).not.toHaveBeenCalled()
  })
})

// ===========================================================================
// SEED-FALLBACK — limit
// ===========================================================================

describe('getSearchSuggestions — limit', () => {
  it('defaults to at most 8 suggestions', async () => {
    // 'a' is a 1-char query (would return []); use 'an' which matches many shows.
    const res = await getSearchSuggestions('an')
    expect(res.length).toBeLessThanOrEqual(8)
  })

  it('respects an explicit limit', async () => {
    const res = await getSearchSuggestions('an', 3)
    expect(res.length).toBeLessThanOrEqual(3)
  })

  it('returns at most `limit` even when more titles match', async () => {
    // Find a substring that matches > 2 seed titles, then cap at 2.
    const all = await getSearchSuggestions('the', 100)
    expect(all.length).toBeGreaterThan(2)
    const capped = await getSearchSuggestions('the', 2)
    expect(capped).toHaveLength(2)
    // The capped set is the prefix of the full ranked set.
    expect(capped.map((s) => s.slug)).toEqual(all.slice(0, 2).map((s) => s.slug))
  })
})

// ===========================================================================
// SEED-FALLBACK — light payload shape (no leak)
// ===========================================================================

describe('getSearchSuggestions — light payload shape', () => {
  it('returns exactly {slug,title,coverImage,year} — no heavy fields leak', async () => {
    const res = await getSearchSuggestions('fr')
    expect(res.length).toBeGreaterThan(0)
    for (const s of res) {
      expect(Object.keys(s).sort()).toEqual(['coverImage', 'slug', 'title', 'year'])
      expect(typeof s.slug).toBe('string')
      expect(typeof s.title).toBe('string')
      expect(typeof s.coverImage).toBe('string')
      expect(s.year === null || typeof s.year === 'number').toBe(true)
      // None of the heavier ShowSummary/ShowDetail fields are present.
      expect(s).not.toHaveProperty('subEpisodes')
      expect(s).not.toHaveProperty('dubEpisodes')
      expect(s).not.toHaveProperty('status')
      expect(s).not.toHaveProperty('synopsis')
      expect(s).not.toHaveProperty('popularityScore')
      expect(s).not.toHaveProperty('popularity')
      expect(s).not.toHaveProperty('id')
    }
  })

  it('coverImage / slug / year reflect the matched seed show', async () => {
    const res = await getSearchSuggestions('frieren')
    const frieren = res.find((s) => s.slug === 'frieren-beyond-journeys-end')
    expect(frieren).toBeDefined()
    const seedShow = SEED_SHOWS.find(
      (s) => s.slug === 'frieren-beyond-journeys-end',
    )!
    expect(frieren!.coverImage).toBe(seedShow.coverImage)
    expect(frieren!.year).toBe(seedShow.year)
    expect(frieren!.title).toBe(seedShow.title)
  })
})

// ===========================================================================
// LIVE path — query construction (happy path, mocked client)
// ===========================================================================

describe('getSearchSuggestions — live Supabase (mocked)', () => {
  beforeEach(() => {
    isConfiguredMock.mockReturnValue(true)
  })

  it('queries the shows table with an ilike title pattern and orders by popularity', async () => {
    installed.select = { data: [rawShow()], error: null }
    await getSearchSuggestions('fr')
    expect(getPublicClientMock).toHaveBeenCalled()
    expect(calls.from).toContain('shows')
    // ilike('title', '%fr%') — wildcards wrap the (escaped) query.
    expect(calls.ilike[0][0]).toBe('title')
    expect(calls.ilike[0][1]).toBe('%fr%')
    expect(calls.order).toContainEqual([
      'popularity_score',
      { ascending: false },
    ])
  })

  it('selects only the light columns (no subEpisodes/status/synopsis)', async () => {
    installed.select = { data: [rawShow()], error: null }
    await getSearchSuggestions('fr')
    const cols = calls.select.join(' ')
    expect(cols).toContain('slug')
    expect(cols).toContain('title')
    expect(cols).toContain('cover_image')
    expect(cols).toContain('year')
    expect(cols).not.toContain('sub_episodes')
    expect(cols).not.toContain('status')
    expect(cols).not.toContain('synopsis')
  })

  it('over-fetches (limit > cap) so the starts-with re-rank has candidates', async () => {
    installed.select = { data: [rawShow()], error: null }
    await getSearchSuggestions('fr', 8)
    expect(calls.limit[0]).toBeGreaterThan(8)
  })

  it('maps rows to the light SearchSuggestion domain shape (no snake_case leak)', async () => {
    installed.select = {
      data: [
        rawShow({
          slug: 'cowboy-bebop',
          title: 'Cowboy Bebop',
          cover_image: 'https://cdn.example.com/cb.jpg',
          year: 1998,
          popularity_score: 50,
        }),
      ],
      error: null,
    }
    const res = await getSearchSuggestions('cowboy')
    expect(res).toEqual([
      {
        slug: 'cowboy-bebop',
        title: 'Cowboy Bebop',
        coverImage: 'https://cdn.example.com/cb.jpg',
        year: 1998,
      },
    ])
    expect(res[0]).not.toHaveProperty('cover_image')
    expect(res[0]).not.toHaveProperty('popularity_score')
  })

  it('escapes LIKE wildcards in the query (defense-in-depth)', async () => {
    installed.select = { data: [], error: null }
    await getSearchSuggestions('a%_b')
    // % and _ are escaped to literals inside the wrapping %…% pattern.
    expect(calls.ilike[0][1]).toBe('%a\\%\\_b%')
  })
})

// ===========================================================================
// RESILIENCE CONTRACT — live error -> seed fallback, never throws
// ===========================================================================

describe('getSearchSuggestions — resilience (live error -> seed)', () => {
  beforeEach(() => {
    isConfiguredMock.mockReturnValue(true)
  })

  it('falls back to the seed (with a warn) when the live query errors', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    installed.select = { data: null, error: { message: 'PGRST205 boom' } }
    const res = await getSearchSuggestions('frieren')
    // The seed has Frieren, so the fallback returns it instead of throwing.
    expect(res.length).toBeGreaterThanOrEqual(1)
    expect(res.some((s) => s.slug === 'frieren-beyond-journeys-end')).toBe(true)
    expect(warn).toHaveBeenCalled()
  })

  it('does NOT throw when the live client itself rejects', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    getPublicClientMock.mockRejectedValueOnce(new Error('connection refused'))
    // The contract: this read fn must never throw — it degrades to the seed.
    await expect(getSearchSuggestions('frieren')).resolves.toBeDefined()
    const res = await (async () => {
      getPublicClientMock.mockRejectedValueOnce(new Error('connection refused'))
      return getSearchSuggestions('frieren')
    })()
    expect(res.some((s) => s.slug === 'frieren-beyond-journeys-end')).toBe(true)
    expect(warn).toHaveBeenCalled()
  })

  it('returns the seed result identical to the unconfigured path on live error', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    installed.select = { data: null, error: { message: 'boom' } }
    const onError = await getSearchSuggestions('fr')

    // Now compare to the genuine seed-fallback (unconfigured) result.
    isConfiguredMock.mockReturnValue(false)
    const seedRes = await getSearchSuggestions('fr')
    expect(onError.map((s) => s.slug)).toEqual(seedRes.map((s) => s.slug))
    expect(warn).toHaveBeenCalled()
  })

  it('still returns [] (no throw) for a short query even when configured', async () => {
    expect(await getSearchSuggestions('f')).toEqual([])
    // Short-circuits before ever touching the client.
    expect(getPublicClientMock).not.toHaveBeenCalled()
  })
})

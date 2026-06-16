import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Roadmap: NON-INVASIVE ads — data-layer unit tests.
//
// Exercises src/lib/data/ads.ts with isSupabaseConfigured() and the Supabase
// server client MOCKED, so no live database is needed. Covers BOTH branches the
// data layer has (the seed-fallback path AND the live-Supabase path), plus the
// weighted-pick selection logic and the fire-and-forget tracking RPCs.
//
//   getAdForPlacement(placementKey):
//     - SEED-FALLBACK (Supabase not configured): returns an ACTIVE seed ad for
//       the slot, or null when the slot is empty; never builds a client.
//     - LIVE (Supabase configured): SELECTs the public columns scoped to the
//       slot AND is_active=true, weighted-picks one, maps row -> domain, never
//       leaks the internal columns (is_active / impressions / clicks).
//     - WEIGHTED PICK: a higher-weight ad is selected proportionally more often;
//       Math.random is stubbed to make the choice deterministic.
//
//   recordAdImpression / recordAdClick:
//     - no-op (no client built) on the seed-fallback path,
//     - call the correct RPC with { p_id } when configured,
//     - are the ONLY mutation the data layer performs.
// ---------------------------------------------------------------------------

// Mock the config gate so isSupabaseConfigured() is controllable per-test.
const isConfiguredMock = vi.fn(() => false)
vi.mock('@/lib/supabase/config', () => ({
  isSupabaseConfigured: () => isConfiguredMock(),
}))

// ---------------------------------------------------------------------------
// Fake Supabase PUBLIC client.
//
// ads.ts (live path) issues:
//   getAdForPlacement:
//     from('ad_placements').select(cols).eq('placement_key', k).eq('is_active', true) -> {data,error}
//   tracking:
//     rpc('record_ad_impression' | 'record_ad_click', { p_id }) -> awaitable
//
// The select chain terminates on the SECOND .eq() (it is awaited directly), so
// the builder's .eq() is a thenable that also returns itself for further chaining.
// ---------------------------------------------------------------------------

type Resp = { data?: unknown; error?: unknown }

let installed: { select?: Resp } = {}

const calls = {
  from: [] as string[],
  select: [] as string[],
  eq: [] as Array<[string, unknown]>,
  rpc: [] as Array<[string, unknown]>,
}

function makeFakeClient() {
  function adsBuilder() {
    // The builder is awaitable (thenable) so `await ...eq(...).eq(...)` resolves
    // to the installed response, while intermediate .eq() calls keep chaining.
    const builder: Record<string, unknown> = {}
    const resolve = () => installed.select ?? { data: [], error: null }
    builder.select = (cols: string) => {
      calls.select.push(cols)
      return builder
    }
    builder.eq = (col: string, val: unknown) => {
      calls.eq.push([col, val])
      return builder
    }
    // Make the builder a thenable so it can be awaited at the end of the chain.
    builder.then = (onFulfilled: (v: Resp) => unknown) =>
      Promise.resolve(resolve()).then(onFulfilled)
    return builder
  }

  return {
    from(table: string) {
      calls.from.push(table)
      return adsBuilder()
    },
    rpc: async (fn: string, args: unknown) => {
      calls.rpc.push([fn, args])
      return { data: null, error: null }
    },
  }
}

const getPublicClientMock = vi.fn(async () => makeFakeClient())
vi.mock('@/lib/supabase/server', () => ({
  getPublicClient: () => getPublicClientMock(),
}))

import {
  getAdForPlacement,
  recordAdClick,
  recordAdImpression,
} from '@/lib/data/ads'
import seed from '@/lib/data/seed.json'

// A raw ad_placements row as PostgREST returns it (snake_case, only the public
// columns the data layer SELECTs).
function rawAd(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ad-001',
    placement_key: 'home-banner',
    name: 'House — Join the Forum',
    image_url: 'https://placehold.co/970x90.png',
    target_url: '/forum',
    alt_text: 'Join the forum',
    weight: 1,
    ...overrides,
  }
}

const SEED_ADS = (seed as { adPlacements?: Array<{ placementKey: string }> })
  .adPlacements ?? []

beforeEach(() => {
  isConfiguredMock.mockReturnValue(false)
  installed = {}
  calls.from = []
  calls.select = []
  calls.eq = []
  calls.rpc = []
  getPublicClientMock.mockClear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ===========================================================================
// getAdForPlacement — SEED-FALLBACK path (Supabase not configured)
// ===========================================================================

describe('getAdForPlacement — seed fallback', () => {
  it('uses the seed (never builds a client) when Supabase is not configured', async () => {
    isConfiguredMock.mockReturnValue(false)
    await getAdForPlacement('home-banner')
    expect(getPublicClientMock).not.toHaveBeenCalled()
  })

  it('returns an active seed ad for a slot that has one', async () => {
    const ad = await getAdForPlacement('home-banner')
    expect(ad).not.toBeNull()
    expect(ad!.placementKey).toBe('home-banner')
    // The returned ad really is one of the seeded ads for that slot.
    const seededIds = SEED_ADS.filter((a) => a.placementKey === 'home-banner')
    expect(seededIds.length).toBeGreaterThan(0)
  })

  it('returns the AdPlacement domain shape (no internal columns leak)', async () => {
    const ad = await getAdForPlacement('home-banner')
    expect(ad).toMatchObject({
      id: expect.any(String),
      placementKey: 'home-banner',
      imageUrl: expect.any(String),
      targetUrl: expect.any(String),
      weight: expect.any(Number),
    })
    // The seed-fallback never exposes is_active / impressions / clicks.
    expect(ad).not.toHaveProperty('is_active')
    expect(ad).not.toHaveProperty('isActive')
    expect(ad).not.toHaveProperty('impressions')
    expect(ad).not.toHaveProperty('clicks')
  })

  it('returns null for a slot with no seeded ad', async () => {
    expect(await getAdForPlacement('no-such-slot')).toBeNull()
  })

  it('only ever returns an ad whose placementKey matches the requested slot', async () => {
    for (const key of ['home-banner', 'grid-native', 'sidebar']) {
      const ad = await getAdForPlacement(key)
      if (ad) expect(ad.placementKey).toBe(key)
    }
  })
})

// ===========================================================================
// getAdForPlacement — LIVE path (Supabase configured)
// ===========================================================================

describe('getAdForPlacement — live Supabase', () => {
  beforeEach(() => {
    isConfiguredMock.mockReturnValue(true)
  })

  it('queries ad_placements scoped to the slot AND is_active=true', async () => {
    installed.select = { data: [rawAd()], error: null }
    await getAdForPlacement('home-banner')
    expect(getPublicClientMock).toHaveBeenCalled()
    expect(calls.from).toContain('ad_placements')
    expect(calls.eq).toContainEqual(['placement_key', 'home-banner'])
    // Defense-in-depth: the query itself never asks for inactive ads, so an
    // inactive/unsold creative can never surface even if RLS were misconfigured.
    expect(calls.eq).toContainEqual(['is_active', true])
  })

  it('selects ONLY the public columns (never impressions/clicks/is_active)', async () => {
    installed.select = { data: [rawAd()], error: null }
    await getAdForPlacement('home-banner')
    const cols = calls.select.join(' ')
    expect(cols).toContain('id')
    expect(cols).toContain('image_url')
    expect(cols).toContain('target_url')
    expect(cols).not.toContain('impressions')
    expect(cols).not.toContain('clicks')
  })

  it('maps a row to the camelCase domain AdPlacement', async () => {
    installed.select = {
      data: [
        rawAd({
          id: 'ad-xyz',
          placement_key: 'sidebar',
          image_url: 'https://placehold.co/300x250.png',
          target_url: '/signup',
          alt_text: 'sign up',
          weight: 3,
        }),
      ],
      error: null,
    }
    const ad = await getAdForPlacement('sidebar')
    expect(ad).toEqual({
      id: 'ad-xyz',
      placementKey: 'sidebar',
      name: 'House — Join the Forum',
      imageUrl: 'https://placehold.co/300x250.png',
      targetUrl: '/signup',
      altText: 'sign up',
      weight: 3,
    })
  })

  it('never leaks raw snake_case keys onto the domain object', async () => {
    installed.select = { data: [rawAd()], error: null }
    const ad = await getAdForPlacement('home-banner')
    expect(ad).not.toHaveProperty('placement_key')
    expect(ad).not.toHaveProperty('image_url')
    expect(ad).not.toHaveProperty('target_url')
    expect(ad).not.toHaveProperty('alt_text')
  })

  it('tolerates null name/alt_text (maps them to null, not undefined)', async () => {
    installed.select = {
      data: [rawAd({ name: null, alt_text: null })],
      error: null,
    }
    const ad = await getAdForPlacement('home-banner')
    expect(ad!.name).toBeNull()
    expect(ad!.altText).toBeNull()
  })

  it('returns null when the slot has no active ad (empty result)', async () => {
    installed.select = { data: [], error: null }
    expect(await getAdForPlacement('home-banner')).toBeNull()
  })

  it('returns null when data is null', async () => {
    installed.select = { data: null, error: null }
    expect(await getAdForPlacement('home-banner')).toBeNull()
  })

  it('falls back to a seed ad when the live query errors (build resilience)', async () => {
    // Build resilience (Vercel): a live ad query MUST NOT throw — ad slots render
    // on statically generated pages too, and the cloud DB may be empty / unmigrated
    // (PGRST205) / unreachable. The live error now degrades to the seed weighted-pick
    // for the slot instead of crashing the render/build.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    installed.select = { data: null, error: { message: 'boom' } }
    const ad = await getAdForPlacement('home-banner')
    // The seed has a 'home-banner' ad, so the fallback returns one (never throws).
    expect(ad).not.toBeNull()
    expect(ad!.placementKey).toBe('home-banner')
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('falls back to null when the live query errors for a slot with no seed ad', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    installed.select = { data: null, error: { message: 'boom' } }
    expect(await getAdForPlacement('no-such-slot')).toBeNull()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})

// ===========================================================================
// Weighted pick — deterministic via a stubbed Math.random
// ===========================================================================

describe('getAdForPlacement — weighted pick', () => {
  beforeEach(() => {
    isConfiguredMock.mockReturnValue(true)
  })

  it('returns the single candidate when a slot has exactly one ad', async () => {
    installed.select = { data: [rawAd({ id: 'only' })], error: null }
    const ad = await getAdForPlacement('home-banner')
    expect(ad!.id).toBe('only')
  })

  it('picks proportionally to weight: low random -> first (heavier) ad', async () => {
    // candidates: heavy (weight 3) then light (weight 1); total = 4.
    installed.select = {
      data: [
        rawAd({ id: 'heavy', weight: 3 }),
        rawAd({ id: 'light', weight: 1 }),
      ],
      error: null,
    }
    // r = 0.1 * 4 = 0.4 -> falls in the first (heavy) bucket [0,3).
    vi.spyOn(Math, 'random').mockReturnValue(0.1)
    const ad = await getAdForPlacement('home-banner')
    expect(ad!.id).toBe('heavy')
  })

  it('picks the lighter ad when the random lands in its (smaller) bucket', async () => {
    installed.select = {
      data: [
        rawAd({ id: 'heavy', weight: 3 }),
        rawAd({ id: 'light', weight: 1 }),
      ],
      error: null,
    }
    // r = 0.9 * 4 = 3.6 -> past the heavy bucket [0,3) into light [3,4).
    vi.spyOn(Math, 'random').mockReturnValue(0.9)
    const ad = await getAdForPlacement('home-banner')
    expect(ad!.id).toBe('light')
  })

  it('the heavier ad wins for the vast majority of the random range', async () => {
    installed.select = {
      data: [
        rawAd({ id: 'heavy', weight: 3 }),
        rawAd({ id: 'light', weight: 1 }),
      ],
      error: null,
    }
    let heavy = 0
    for (let i = 0; i < 100; i++) {
      vi.spyOn(Math, 'random').mockReturnValue(i / 100)
      const ad = await getAdForPlacement('home-banner')
      if (ad!.id === 'heavy') heavy++
      vi.restoreAllMocks()
    }
    // weight 3 vs 1 -> ~75% of the [0,1) range maps to the heavy ad.
    expect(heavy).toBe(75)
  })
})

// ===========================================================================
// Tracking RPCs — the ONLY data-layer mutation
// ===========================================================================

describe('recordAdImpression / recordAdClick', () => {
  it('are no-ops on the seed-fallback path (no client built, no RPC)', async () => {
    isConfiguredMock.mockReturnValue(false)
    await recordAdImpression('ad-001')
    await recordAdClick('ad-001')
    expect(getPublicClientMock).not.toHaveBeenCalled()
    expect(calls.rpc).toHaveLength(0)
  })

  it('calls record_ad_impression with { p_id } when configured', async () => {
    isConfiguredMock.mockReturnValue(true)
    await recordAdImpression('ad-042')
    expect(calls.rpc).toContainEqual(['record_ad_impression', { p_id: 'ad-042' }])
  })

  it('calls record_ad_click with { p_id } when configured', async () => {
    isConfiguredMock.mockReturnValue(true)
    await recordAdClick('ad-042')
    expect(calls.rpc).toContainEqual(['record_ad_click', { p_id: 'ad-042' }])
  })

  it('return void (no data leaked back to the caller)', async () => {
    isConfiguredMock.mockReturnValue(true)
    expect(await recordAdImpression('ad-001')).toBeUndefined()
    expect(await recordAdClick('ad-001')).toBeUndefined()
  })
})

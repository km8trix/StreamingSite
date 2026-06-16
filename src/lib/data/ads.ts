// ads.ts — Non-invasive advertising data access (Roadmap: ad slots).
//
// READ:
//   getAdForPlacement(placementKey) -> ONE active ad for the slot, chosen by
//     WEIGHTED RANDOM (so it may vary per request — do NOT call during the static
//     prerender of a cached page, same caveat as getRandomShow). Returns null
//     when the slot has no active ad / Supabase isn't configured-and-empty.
//
// TRACKING (the ONLY client-reachable mutation):
//   recordAdImpression(id) / recordAdClick(id) -> +1 the counter on the named,
//     ACTIVE ad via the SECURITY DEFINER RPCs (record_ad_impression /
//     record_ad_click). The client holds NO write grant on ad_placements; the
//     RPC body is the whole permission boundary (a single `+1` on the active id).
//     No-op on the offline seed-fallback path (no DB to write to).
//
// Reads use the cookie-free PUBLIC anon client (getPublicClient) — ads are
// public data, never user-scoped. RLS exposes ACTIVE ads only, so an inactive /
// unsold creative can never surface here even if its id is guessed.
//
// Raw Supabase rows never leak: mapAdRow centralizes row -> domain, and the
// internal columns (is_active / impressions / clicks) are dropped on the way out.

import { getPublicClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import seed from './seed.json'
import type { AdPlacement } from './types'

// ---------------------------------------------------------------------------
// Seed typing — seed.json holds only ACTIVE ads (the fallback never serves
// inactive creatives, mirroring the live RLS active-only contract).
// ---------------------------------------------------------------------------

type SeedAd = {
  id: string
  placementKey: string
  name: string | null
  imageUrl: string
  targetUrl: string
  altText: string | null
  weight: number
}

const SEED_ADS = (seed as typeof seed & { adPlacements?: SeedAd[] })
  .adPlacements ?? []

// ---------------------------------------------------------------------------
// Supabase row -> domain mapper
// ---------------------------------------------------------------------------

// We only ever SELECT the public-facing columns; is_active / impressions /
// clicks stay server-side and never reach the UI.
type AdRow = {
  id: string
  placement_key: string
  name: string | null
  image_url: string
  target_url: string
  alt_text: string | null
  weight: number
}

const AD_COLUMNS =
  'id, placement_key, name, image_url, target_url, alt_text, weight'

function mapAdRow(row: AdRow): AdPlacement {
  return {
    id: row.id,
    placementKey: row.placement_key,
    name: row.name ?? null,
    imageUrl: row.image_url,
    targetUrl: row.target_url,
    altText: row.alt_text ?? null,
    weight: row.weight,
  }
}

/**
 * Pick one ad from a candidate list by WEIGHTED random. Weights are positive
 * integers (the DB CHECK guarantees weight > 0); an ad with weight 2 is twice as
 * likely as weight 1. Returns null for an empty list.
 */
function weightedPick(ads: AdPlacement[]): AdPlacement | null {
  if (ads.length === 0) return null
  const total = ads.reduce((sum, ad) => sum + Math.max(1, ad.weight), 0)
  let r = Math.random() * total
  for (const ad of ads) {
    r -= Math.max(1, ad.weight)
    if (r < 0) return ad
  }
  // Floating-point safety net: return the last candidate.
  return ads[ads.length - 1] ?? null
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/**
 * One ACTIVE ad for the given slot, chosen by weighted random. May vary per
 * request. Returns null when the slot has no active ad.
 *   - seed-fallback path: weighted-pick from seed.json adPlacements (active only).
 *   - Supabase path: SELECT active ads for the slot (RLS already filters to
 *     is_active), then weighted-pick in memory.
 */
export async function getAdForPlacement(
  placementKey: string,
): Promise<AdPlacement | null> {
  if (!isSupabaseConfigured()) return seedAdForPlacement(placementKey)

  try {
    const supabase = await getPublicClient()
    const { data, error } = await supabase
      .from('ad_placements')
      .select(AD_COLUMNS)
      // RLS already restricts to is_active; this is a defense-in-depth filter so
      // the intent is explicit at the query level too.
      .eq('placement_key', placementKey)
      .eq('is_active', true)

    if (error) throw error
    const ads = ((data ?? []) as AdRow[]).map(mapAdRow)
    return weightedPick(ads)
  } catch (err) {
    // A live query MUST NEVER throw out of this read fn: ad slots render on every
    // page (incl. statically generated ones at `next build`), and the cloud DB may
    // be empty / unmigrated (PGRST205) / unreachable. Log once, fall back to seed.
    console.warn('[data] getAdForPlacement live query failed, falling back:', err)
    return seedAdForPlacement(placementKey)
  }
}

// Weighted pick from the seed ad placements — the seed-fallback result.
function seedAdForPlacement(placementKey: string): AdPlacement | null {
  const candidates = SEED_ADS.filter((a) => a.placementKey === placementKey)
  return weightedPick(candidates)
}

// ---------------------------------------------------------------------------
// Tracking — the ONLY client-reachable mutation (SECURITY DEFINER RPCs)
// ---------------------------------------------------------------------------

/**
 * +1 the impression counter on the active ad `id` via the record_ad_impression
 * RPC. No-op on the seed-fallback path. Failures are swallowed (best-effort
 * analytics must never break a render).
 */
export async function recordAdImpression(id: string): Promise<void> {
  if (!isSupabaseConfigured()) return
  const supabase = await getPublicClient()
  await supabase.rpc('record_ad_impression', { p_id: id })
}

/**
 * +1 the click counter on the active ad `id` via the record_ad_click RPC. No-op
 * on the seed-fallback path. Failures are swallowed (best-effort analytics).
 */
export async function recordAdClick(id: string): Promise<void> {
  if (!isSupabaseConfigured()) return
  const supabase = await getPublicClient()
  await supabase.rpc('record_ad_click', { p_id: id })
}

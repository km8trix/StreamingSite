// Watchlist — read side (signed-in users). Mirrors watch-progress.ts.
//
// Session-scoped: uses the cookie-based getServerClient() so RLS returns only
// THE CALLER'S rows. Guests have no DB rows; their list lives in localStorage
// and is read client-side (see src/lib/watch/watchlist-guest-store.ts), so this
// returns [] / false for guests.
//
// Build-resilient: a live failure (missing migration, unreachable DB) logs once
// and degrades to empty — "My List" simply doesn't render, never crashes.

import { getServerClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { getCurrentUser } from './profiles'
import type { WatchlistItem } from './types'

const DEFAULT_LIMIT = 24

type EmbeddedShow = {
  slug: string
  title: string
  cover_image: string
  year: number | null
}

type WatchlistRow = {
  show_id: string
  created_at: string
  // PostgREST returns a to-one embed as an object, but the generated typings
  // sometimes widen it to an array — normalize with one().
  shows: EmbeddedShow | EmbeddedShow[] | null
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

/**
 * The signed-in user's saved shows ("My List"), newest-first. Returns [] when
 * Supabase is unconfigured, the user is signed out, or the query fails.
 */
export async function getWatchlist(
  limit: number = DEFAULT_LIMIT,
): Promise<WatchlistItem[]> {
  if (!isSupabaseConfigured()) return []

  try {
    const user = await getCurrentUser()
    if (!user) return []

    const supabase = await getServerClient()
    const { data, error } = await supabase
      .from('watchlist')
      .select(
        `show_id, created_at,
         shows!inner ( slug, title, cover_image, year )`,
      )
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    const items: WatchlistItem[] = []
    for (const row of (data ?? []) as unknown as WatchlistRow[]) {
      const show = one(row.shows)
      if (!show) continue
      items.push({
        showId: row.show_id,
        slug: show.slug,
        title: show.title,
        coverImage: show.cover_image,
        year: show.year ?? null,
        addedAt: row.created_at,
      })
    }
    return items
  } catch (err) {
    console.warn('[data] getWatchlist live query failed, falling back:', err)
    return []
  }
}

/**
 * Whether the signed-in user has the given show saved. Used to seed the Save
 * button's initial state server-side (no hydration flash). False for guests,
 * unconfigured, or on any error.
 */
export async function isInWatchlist(showId: string): Promise<boolean> {
  if (!isSupabaseConfigured() || !showId) return false

  try {
    const user = await getCurrentUser()
    if (!user) return false

    const supabase = await getServerClient()
    const { data, error } = await supabase
      .from('watchlist')
      .select('show_id')
      .eq('show_id', showId)
      .maybeSingle()

    if (error) throw error
    return Boolean(data)
  } catch (err) {
    console.warn('[data] isInWatchlist live query failed, falling back:', err)
    return false
  }
}

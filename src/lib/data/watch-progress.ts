// Continue Watching — read side (signed-in users).
//
// Session-scoped: unlike the public catalog reads (getPublicClient), this must
// see the user's auth cookie so RLS returns only THEIR rows — so it uses the
// cookie-based getServerClient(). Guests have no DB rows; their progress lives
// in localStorage and is read client-side (see src/lib/watch/guest-store.ts),
// so this returns [] for guests.
//
// Build-resilient: a live failure (missing migration, unreachable DB) logs once
// and returns [] — Continue Watching simply doesn't render, never crashes.

import { getServerClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { getCurrentUser } from './profiles'
import type { ContinueWatchingItem } from './types'

const DEFAULT_LIMIT = 12

type EmbeddedShow = { slug: string; title: string; cover_image: string }
type EmbeddedEpisode = { number: number; title: string | null }

type WatchProgressRow = {
  show_id: string
  episode_id: string
  position_seconds: number
  duration_seconds: number
  updated_at: string
  // PostgREST returns a to-one embed as an object, but the generated typings
  // sometimes widen it to an array — normalize with one().
  shows: EmbeddedShow | EmbeddedShow[] | null
  episodes: EmbeddedEpisode | EmbeddedEpisode[] | null
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

/**
 * The signed-in user's "Continue Watching" list, newest activity first. One item
 * per show (the row already holds the current resume episode + position). Returns
 * [] when Supabase is unconfigured, the user is signed out, or the query fails.
 */
export async function getContinueWatching(
  limit: number = DEFAULT_LIMIT,
): Promise<ContinueWatchingItem[]> {
  if (!isSupabaseConfigured()) return []

  try {
    const user = await getCurrentUser()
    if (!user) return []

    const supabase = await getServerClient()
    const { data, error } = await supabase
      .from('watch_progress')
      .select(
        `show_id, episode_id, position_seconds, duration_seconds, updated_at,
         shows!inner ( slug, title, cover_image ),
         episodes!inner ( number, title )`,
      )
      .order('updated_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    const items: ContinueWatchingItem[] = []
    for (const row of (data ?? []) as unknown as WatchProgressRow[]) {
      const show = one(row.shows)
      const episode = one(row.episodes)
      if (!show || !episode) continue
      items.push({
        showId: row.show_id,
        slug: show.slug,
        title: show.title,
        coverImage: show.cover_image,
        episodeId: row.episode_id,
        episodeNumber: episode.number,
        episodeTitle: episode.title ?? null,
        positionSeconds: row.position_seconds,
        durationSeconds: row.duration_seconds,
        updatedAt: row.updated_at,
      })
    }
    return items
  } catch (err) {
    console.warn(
      '[data] getContinueWatching live query failed, falling back:',
      err,
    )
    return []
  }
}

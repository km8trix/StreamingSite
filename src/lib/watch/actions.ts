'use server'

// Continue Watching — write side (signed-in users).
//
// All writes go through the SECURITY DEFINER record_watch_progress() RPC (see
// 0009), which pins user_id = auth.uid() and applies the advance/drop rules, so
// these actions never trust client-supplied user ids. They use the cookie-based
// getServerClient() so the RPC sees the caller's session.
//
// recordWatchProgress is called frequently (every ~10s of playback), so it is a
// quiet no-op when signed out / unconfigured and never throws at the caller —
// progress tracking must never interrupt playback.

import { revalidatePath } from 'next/cache'
import { getServerClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { getCurrentUser } from '@/lib/data/profiles'

export type WatchWriteResult = { ok: boolean }

// Cap how many guest entries we accept in one login-merge to bound the work.
const MAX_MERGE_ENTRIES = 50

function clampSeconds(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || n < 0) return 0
  // Guard against absurd values; floor to whole seconds for the integer column.
  return Math.min(Math.floor(n), 1_000_000)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

/**
 * Record the current resume point for one show. No-op (ok:false) when signed out
 * or unconfigured. Never throws — a tracking failure must not break playback.
 */
export async function recordWatchProgress(
  showId: string,
  episodeId: string,
  positionSeconds: number,
  durationSeconds: number,
): Promise<WatchWriteResult> {
  if (!isSupabaseConfigured()) return { ok: false }
  if (!isNonEmptyString(showId) || !isNonEmptyString(episodeId)) {
    return { ok: false }
  }

  try {
    const user = await getCurrentUser()
    if (!user) return { ok: false }

    const supabase = await getServerClient()
    const { error } = await supabase.rpc('record_watch_progress', {
      p_show_id: showId,
      p_episode_id: episodeId,
      p_position_seconds: clampSeconds(positionSeconds),
      p_duration_seconds: clampSeconds(durationSeconds),
    })
    if (error) throw error
    return { ok: true }
  } catch (err) {
    console.warn('[watch] recordWatchProgress failed:', err)
    return { ok: false }
  }
}

type GuestEntryInput = {
  showId: string
  episodeId: string
  positionSeconds: number
  durationSeconds: number
}

/**
 * Flush a guest's localStorage progress into the DB after they sign in. Each
 * entry is replayed through the same RPC (so advancement rules apply uniformly).
 * Best-effort: a bad entry is skipped, never fatal. Revalidates the home rail.
 */
export async function mergeGuestProgress(
  entries: GuestEntryInput[],
): Promise<{ merged: number }> {
  if (!isSupabaseConfigured() || !Array.isArray(entries) || entries.length === 0) {
    return { merged: 0 }
  }

  let merged = 0
  try {
    const user = await getCurrentUser()
    if (!user) return { merged: 0 }

    const supabase = await getServerClient()
    for (const entry of entries.slice(0, MAX_MERGE_ENTRIES)) {
      if (!isNonEmptyString(entry?.showId) || !isNonEmptyString(entry?.episodeId)) {
        continue
      }
      const { error } = await supabase.rpc('record_watch_progress', {
        p_show_id: entry.showId,
        p_episode_id: entry.episodeId,
        p_position_seconds: clampSeconds(entry.positionSeconds),
        p_duration_seconds: clampSeconds(entry.durationSeconds),
      })
      if (!error) merged += 1
    }
  } catch (err) {
    console.warn('[watch] mergeGuestProgress failed:', err)
  }

  if (merged > 0) revalidatePath('/', 'layout')
  return { merged }
}

/**
 * Remove a show from the signed-in user's Continue Watching rail. RLS scopes the
 * delete to the caller's own row, so the show_id filter is sufficient.
 */
export async function dismissContinueWatching(
  showId: string,
): Promise<WatchWriteResult> {
  if (!isSupabaseConfigured() || !isNonEmptyString(showId)) return { ok: false }

  try {
    const user = await getCurrentUser()
    if (!user) return { ok: false }

    const supabase = await getServerClient()
    const { error } = await supabase
      .from('watch_progress')
      .delete()
      .eq('show_id', showId)
    if (error) throw error

    revalidatePath('/', 'layout')
    return { ok: true }
  } catch (err) {
    console.warn('[watch] dismissContinueWatching failed:', err)
    return { ok: false }
  }
}

/**
 * Record a show-view engagement event for the "Top Anime" rankings. Works for
 * guests (auth.uid() is null) and signed-in users alike — the RPC dedups
 * signed-in users to one counted view per show per hour. Fire-and-forget: a
 * no-op when unconfigured, never throws.
 */
export async function recordShowView(showId: string): Promise<void> {
  if (!isSupabaseConfigured() || !isNonEmptyString(showId)) return
  try {
    const supabase = await getServerClient()
    await supabase.rpc('record_show_view', { p_show_id: showId })
  } catch (err) {
    console.warn('[watch] recordShowView failed:', err)
  }
}

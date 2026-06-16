// Continue Watching — guest store (no account).
//
// Guests keep their resume state in localStorage instead of the DB. Entries are
// SELF-CONTAINED (show slug/title/cover + episode) so the rail renders without a
// server round-trip. The advancement rule (>=90% -> next episode, or drop after
// the last) mirrors the server RPC in 0009 so guest and signed-in behavior match;
// on sign-in these entries are flushed to the DB (see GuestProgressSync).
//
// Every access is window-guarded and wrapped so disabled/over-quota storage or
// corrupt JSON degrades to "no history" rather than throwing.

import type { ContinueWatchingItem, Episode } from '@/lib/data'

const STORAGE_KEY = 'senpai:continue-watching:v1'
const MAX_ENTRIES = 24

// Shared with the server RPC's threshold: an episode is "finished" at >=90%.
export const FINISHED_FRACTION = 0.9

// Keyed by showId so there is exactly one resume entry per show.
type GuestStore = Record<string, ContinueWatchingItem>

function hasWindow(): boolean {
  return typeof window !== 'undefined' && !!window.localStorage
}

function clampSeconds(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0
  return Math.min(Math.floor(value), 1_000_000)
}

function isValidItem(v: unknown): v is ContinueWatchingItem {
  if (!v || typeof v !== 'object') return false
  const i = v as Record<string, unknown>
  return (
    typeof i.showId === 'string' &&
    typeof i.slug === 'string' &&
    typeof i.title === 'string' &&
    typeof i.coverImage === 'string' &&
    typeof i.episodeId === 'string' &&
    typeof i.episodeNumber === 'number' &&
    typeof i.positionSeconds === 'number' &&
    typeof i.durationSeconds === 'number' &&
    typeof i.updatedAt === 'string'
  )
}

function readStore(): GuestStore {
  if (!hasWindow()) return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return {}
    const out: GuestStore = {}
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (isValidItem(value)) out[key] = value
    }
    return out
  } catch {
    return {}
  }
}

function writeStore(store: GuestStore): void {
  if (!hasWindow()) return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    // quota exceeded / storage disabled — silently drop (history is best-effort)
  }
  notifyGuestListeners()
}

// The DOM 'storage' event only fires in OTHER tabs, so we keep our own listener
// set and notify it after every SAME-TAB mutation. This makes the rail's
// useSyncExternalStore reflect a dismiss/record immediately, not just on remount.
const guestListeners = new Set<() => void>()

function notifyGuestListeners(): void {
  for (const listener of guestListeners) listener()
}

/** Guest resume list, newest-first, capped. */
export function readGuestProgress(): ContinueWatchingItem[] {
  return Object.values(readStore())
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, MAX_ENTRIES)
}

export type RecordGuestParams = {
  show: { id: string; slug: string; title: string; coverImage: string }
  episode: { id: string; number: number; title: string | null }
  positionSeconds: number
  durationSeconds: number
  // The show's full episode list, used to resolve the "next episode" on finish.
  episodes: Pick<Episode, 'id' | 'number' | 'title'>[]
}

/**
 * Record a guest's resume point for one show, applying the same advance/drop
 * rules as the server: at >=90% jump to the next episode (position 0), or remove
 * the show entirely if that was the last episode; otherwise store the position.
 */
export function recordGuestProgress(params: RecordGuestParams): void {
  if (!hasWindow()) return

  const { show, episode, episodes } = params
  const pos = clampSeconds(params.positionSeconds)
  const dur = clampSeconds(params.durationSeconds)
  const fraction = dur > 0 ? pos / dur : 0
  const nowIso = new Date().toISOString()
  const store = readStore()

  const put = (
    ep: { id: string; number: number; title: string | null },
    p: number,
    d: number,
  ) => {
    store[show.id] = {
      showId: show.id,
      slug: show.slug,
      title: show.title,
      coverImage: show.coverImage,
      episodeId: ep.id,
      episodeNumber: ep.number,
      episodeTitle: ep.title ?? null,
      positionSeconds: p,
      durationSeconds: d,
      updatedAt: nowIso,
    }
  }

  if (fraction >= FINISHED_FRACTION) {
    const next = [...episodes]
      .sort((a, b) => a.number - b.number)
      .find((e) => e.number > episode.number)
    if (!next) {
      delete store[show.id] // finished the last episode → leave the rail
    } else {
      put({ id: next.id, number: next.number, title: next.title ?? null }, 0, 0)
    }
  } else {
    put(episode, pos, dur)
  }

  writeStore(store)
}

/** Remove one show from the guest rail (dismiss). */
export function removeGuestShow(showId: string): void {
  const store = readStore()
  if (store[showId]) {
    delete store[showId]
    writeStore(store)
  }
}

/** Clear all guest progress (used after a successful login-merge). */
export function clearGuestProgress(): void {
  if (!hasWindow()) return
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
  notifyGuestListeners()
}

// --- useSyncExternalStore adapters --------------------------------------
// Let the rail subscribe to localStorage the idiomatic React way (no
// setState-in-effect). getSnapshot MUST return a referentially-stable value
// when nothing changed, so we cache by the raw JSON string.

const EMPTY_GUEST_LIST: ContinueWatchingItem[] = []
let snapshotCacheRaw: string | null = null
let snapshotCache: ContinueWatchingItem[] = EMPTY_GUEST_LIST

export function subscribeGuestProgress(onChange: () => void): () => void {
  // Same-tab notifications (record/dismiss/clear) + cross-tab 'storage' events.
  guestListeners.add(onChange)
  if (hasWindow()) window.addEventListener('storage', onChange)
  return () => {
    guestListeners.delete(onChange)
    if (hasWindow()) window.removeEventListener('storage', onChange)
  }
}

export function getGuestProgressSnapshot(): ContinueWatchingItem[] {
  if (!hasWindow()) return EMPTY_GUEST_LIST
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (raw === snapshotCacheRaw) return snapshotCache
  snapshotCacheRaw = raw
  snapshotCache = readGuestProgress()
  return snapshotCache
}

export function getGuestProgressServerSnapshot(): ContinueWatchingItem[] {
  return EMPTY_GUEST_LIST
}

/** The show ids a guest has watched — the signal for personalized recs. */
export function readGuestWatchedShowIds(): string[] {
  return readGuestProgress().map((i) => i.showId)
}

/** Minimal entries to flush to the DB on sign-in. */
export function readGuestMergeEntries(): Array<{
  showId: string
  episodeId: string
  positionSeconds: number
  durationSeconds: number
}> {
  return readGuestProgress().map((i) => ({
    showId: i.showId,
    episodeId: i.episodeId,
    positionSeconds: i.positionSeconds,
    durationSeconds: i.durationSeconds,
  }))
}

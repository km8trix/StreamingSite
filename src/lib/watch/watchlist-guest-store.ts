// Watchlist — guest store (no account). Mirrors guest-store.ts.
//
// Guests keep their saved shows in localStorage instead of the DB. Entries are
// SELF-CONTAINED (slug/title/cover/year) so the "My List" rail renders without a
// server round-trip. On sign-in these are flushed to the DB via add_to_watchlist
// (see GuestProgressSync, the login-merge path).
//
// Every access is window-guarded and wrapped so disabled/over-quota storage or
// corrupt JSON degrades to "empty list" rather than throwing.

import type { WatchlistItem } from '@/lib/data'

const STORAGE_KEY = 'senpai:watchlist:v1'
const MAX_ENTRIES = 100

// Keyed by showId so there is exactly one entry per saved show.
type GuestStore = Record<string, WatchlistItem>

function hasWindow(): boolean {
  return typeof window !== 'undefined' && !!window.localStorage
}

function isValidItem(v: unknown): v is WatchlistItem {
  if (!v || typeof v !== 'object') return false
  const i = v as Record<string, unknown>
  return (
    typeof i.showId === 'string' &&
    typeof i.slug === 'string' &&
    typeof i.title === 'string' &&
    typeof i.coverImage === 'string' &&
    (i.year === null || typeof i.year === 'number') &&
    typeof i.addedAt === 'string'
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
    // quota exceeded / storage disabled — silently drop (best-effort)
  }
  notifyGuestListeners()
}

// The DOM 'storage' event only fires in OTHER tabs, so we keep our own listener
// set and notify it after every SAME-TAB mutation so a save/remove reflects in
// the rail and the Save button immediately (useSyncExternalStore).
const guestListeners = new Set<() => void>()

function notifyGuestListeners(): void {
  for (const listener of guestListeners) listener()
}

/** Guest saved list, newest-first, capped. */
export function readGuestWatchlist(): WatchlistItem[] {
  return Object.values(readStore())
    .sort((a, b) => b.addedAt.localeCompare(a.addedAt))
    .slice(0, MAX_ENTRIES)
}

/** Whether a show is in the guest's saved list. */
export function isGuestWatchlisted(showId: string): boolean {
  return Boolean(readStore()[showId])
}

/** Save a show to the guest list (idempotent; refreshes addedAt). */
export function addGuestWatchlist(item: WatchlistItem): void {
  if (!hasWindow() || !item?.showId) return
  const store = readStore()
  store[item.showId] = {
    showId: item.showId,
    slug: item.slug,
    title: item.title,
    coverImage: item.coverImage,
    year: item.year ?? null,
    addedAt: new Date().toISOString(),
  }
  writeStore(store)
}

/** Remove a show from the guest list. */
export function removeGuestWatchlist(showId: string): void {
  const store = readStore()
  if (store[showId]) {
    delete store[showId]
    writeStore(store)
  }
}

/** Clear the whole guest list (used after a successful login-merge). */
export function clearGuestWatchlist(): void {
  if (!hasWindow()) return
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
  notifyGuestListeners()
}

/** The show ids a guest has saved — flushed to the DB on sign-in. */
export function readGuestWatchlistShowIds(): string[] {
  return readGuestWatchlist().map((i) => i.showId)
}

// --- useSyncExternalStore adapters --------------------------------------
// getSnapshot MUST return a referentially-stable value when nothing changed, so
// the list snapshot is cached by the raw JSON string. The membership snapshot
// (isGuestWatchlisted) returns a boolean, which is already value-stable.

const EMPTY_GUEST_LIST: WatchlistItem[] = []
let snapshotCacheRaw: string | null = null
let snapshotCache: WatchlistItem[] = EMPTY_GUEST_LIST

export function subscribeGuestWatchlist(onChange: () => void): () => void {
  guestListeners.add(onChange)
  if (hasWindow()) window.addEventListener('storage', onChange)
  return () => {
    guestListeners.delete(onChange)
    if (hasWindow()) window.removeEventListener('storage', onChange)
  }
}

export function getGuestWatchlistSnapshot(): WatchlistItem[] {
  if (!hasWindow()) return EMPTY_GUEST_LIST
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (raw === snapshotCacheRaw) return snapshotCache
  snapshotCacheRaw = raw
  snapshotCache = readGuestWatchlist()
  return snapshotCache
}

export function getGuestWatchlistServerSnapshot(): WatchlistItem[] {
  return EMPTY_GUEST_LIST
}

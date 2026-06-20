'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { clearGuestProgress, readGuestMergeEntries } from '@/lib/watch/guest-store'
import {
  clearGuestWatchlist,
  readGuestWatchlistShowIds,
} from '@/lib/watch/watchlist-guest-store'
import { mergeGuestProgress, mergeGuestWatchlist } from '@/lib/watch/actions'

/**
 * GuestProgressSync — one-shot login-merge. When a previously-guest visitor is
 * now signed in and still has localStorage state, flush it into the DB (via the
 * same idempotent RPCs), clear localStorage, and refresh so the server-rendered
 * rails reflect the merged rows. Covers BOTH Continue Watching progress and the
 * "My List" watchlist.
 *
 * Renders nothing. Mounted on the home page (the default post-login landing).
 */
export function GuestProgressSync({ isSignedIn }: { isSignedIn: boolean }) {
  const router = useRouter()
  const ranRef = useRef(false)

  useEffect(() => {
    if (!isSignedIn || ranRef.current) return
    const progress = readGuestMergeEntries()
    const watchlist = readGuestWatchlistShowIds()
    if (progress.length === 0 && watchlist.length === 0) return

    ranRef.current = true
    // The merge actions never throw (they swallow errors and return a count). Only
    // clear a store when its flush actually persisted rows (merged > 0) — a
    // transient failure (e.g. the session cookie not yet propagated right after an
    // OAuth redirect) returns 0, and clearing then would destroy the guest's data
    // before it reached the DB. The idempotent RPCs make a retry on the next visit
    // safe. Refresh the server-rendered rails if anything landed.
    Promise.allSettled([
      progress.length > 0
        ? mergeGuestProgress(progress).then((res) => {
            if (res.merged > 0) clearGuestProgress()
            return res.merged
          })
        : Promise.resolve(0),
      watchlist.length > 0
        ? mergeGuestWatchlist(watchlist).then((res) => {
            if (res.merged > 0) clearGuestWatchlist()
            return res.merged
          })
        : Promise.resolve(0),
    ]).then((results) => {
      const merged = results.reduce(
        (sum, r) => sum + (r.status === 'fulfilled' ? r.value : 0),
        0,
      )
      if (merged > 0) router.refresh()
    })
  }, [isSignedIn, router])

  return null
}

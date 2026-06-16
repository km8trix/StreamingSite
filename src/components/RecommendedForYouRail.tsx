'use client'

import { useEffect, useState } from 'react'
import type { ShowSummary } from '@/lib/data'
import { readGuestWatchedShowIds } from '@/lib/watch/guest-store'
import { ShowCarousel } from './ShowCarousel'

/**
 * RecommendedForYouRail — personalized "Recommended For You", under Continue
 * Watching. Replaces the old generic rail.
 *
 *   - signed-in → `shows` are computed server-side from the user's watch history
 *     (genre overlap), with a generic fallback baked in;
 *   - guest     → `shows` arrives as the generic baseline; if the visitor has
 *     local watch history we upgrade to personalized recs from the API (the
 *     server can't read their localStorage). No history => keep the baseline.
 *
 * Either way it falls back to generic recommendations, so the rail is populated
 * for everyone; it only renders null if there are genuinely no shows.
 */
export function RecommendedForYouRail({
  shows,
  isSignedIn,
}: {
  shows: ShowSummary[]
  isSignedIn: boolean
}) {
  const [guestShows, setGuestShows] = useState<ShowSummary[] | null>(null)

  useEffect(() => {
    if (isSignedIn) return
    const watched = readGuestWatchedShowIds()
    if (watched.length === 0) return // keep the server-provided generic baseline

    let cancelled = false
    fetch('/api/recommendations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ watched }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && Array.isArray(data?.shows) && data.shows.length > 0) {
          setGuestShows(data.shows as ShowSummary[])
        }
      })
      .catch(() => {
        // Network/parse failure -> keep the generic baseline already shown.
      })
    return () => {
      cancelled = true
    }
  }, [isSignedIn])

  const list = isSignedIn ? shows : (guestShows ?? shows)
  if (list.length === 0) return null

  return <ShowCarousel title="Recommended For You" shows={list} />
}

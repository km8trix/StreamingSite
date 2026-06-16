'use client'

import { useEffect, useRef } from 'react'
import { recordShowView } from '@/lib/watch/actions'

/**
 * ShowViewTracker — records a single "view" engagement event when a show detail
 * page is opened, feeding the Top Anime rankings. Renders nothing.
 *
 * Deduped per browser SESSION per show (sessionStorage) so navigating back to a
 * show, or a Strict-Mode double effect, doesn't inflate the count. Signed-in
 * users are additionally rate-limited server-side (once per show per hour);
 * guests rely on this session dedup. Fire-and-forget — recordShowView never
 * throws.
 */
export function ShowViewTracker({ showId }: { showId: string }) {
  const firedRef = useRef(false)

  useEffect(() => {
    if (firedRef.current || !showId) return
    firedRef.current = true

    const key = `senpai:viewed:${showId}`
    try {
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, '1')
    } catch {
      // sessionStorage disabled — fall through and record once per mount.
    }

    void recordShowView(showId)
  }, [showId])

  return null
}

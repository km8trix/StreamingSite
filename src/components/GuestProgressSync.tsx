'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { clearGuestProgress, readGuestMergeEntries } from '@/lib/watch/guest-store'
import { mergeGuestProgress } from '@/lib/watch/actions'

/**
 * GuestProgressSync — one-shot login-merge. When a previously-guest visitor is
 * now signed in and still has localStorage progress, flush it into the DB
 * (via the same RPC, so advancement rules apply), clear localStorage, and
 * refresh so the server-rendered rail reflects the merged rows.
 *
 * Renders nothing. Mounted on the home page (the default post-login landing).
 */
export function GuestProgressSync({ isSignedIn }: { isSignedIn: boolean }) {
  const router = useRouter()
  const ranRef = useRef(false)

  useEffect(() => {
    if (!isSignedIn || ranRef.current) return
    const entries = readGuestMergeEntries()
    if (entries.length === 0) return

    ranRef.current = true
    mergeGuestProgress(entries)
      .then((res) => {
        clearGuestProgress()
        if (res.merged > 0) router.refresh()
      })
      .catch(() => {
        // Best-effort: leave localStorage intact so a later visit can retry.
        ranRef.current = false
      })
  }, [isSignedIn, router])

  return null
}

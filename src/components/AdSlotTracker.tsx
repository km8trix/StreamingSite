'use client'

import { useEffect, useRef } from 'react'
import { recordAdClick, recordAdImpression } from '@/lib/ads/actions'

/**
 * AdSlotTracker — the tiny CLIENT island for one ad slot. It does NOT render the
 * ad itself (that is server-rendered in AdSlot so the markup ships in the initial
 * HTML with a reserved height — no layout shift, no client fetch). This component
 * only wires best-effort, fire-and-forget analytics:
 *
 *   - IMPRESSION: recorded LAZILY and ONCE when the slot scrolls into view, via an
 *     IntersectionObserver on the wrapping element (so ads below the fold aren't
 *     counted until actually seen). Falls back to a single immediate impression
 *     when IntersectionObserver is unavailable.
 *   - CLICK: recorded when the ad link is activated, then navigation proceeds
 *     normally (the <a> in AdSlot still does the navigating — we never preventDefault,
 *     so there is no popup/interstitial and no broken link if tracking fails).
 *
 * Tracking failures are swallowed in the data layer; they must never break the
 * page. The slot reserves its height in AdSlot regardless of this component.
 */
export function AdSlotTracker({
  adId,
  children,
}: {
  adId: string
  children: React.ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const recordedRef = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el || recordedRef.current) return

    const fire = () => {
      if (recordedRef.current) return
      recordedRef.current = true
      // Fire-and-forget; the action swallows failures.
      void recordAdImpression(adId)
    }

    // No IntersectionObserver (older browsers / test envs): count once now.
    if (typeof IntersectionObserver === 'undefined') {
      fire()
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            fire()
            observer.disconnect()
            break
          }
        }
      },
      // Count it as seen once ~50% of the slot is visible.
      { threshold: 0.5 },
    )
    observer.observe(el)

    return () => observer.disconnect()
  }, [adId])

  return (
    <div
      ref={ref}
      // h-full w-full so the reserved-height chain (aside aspect-ratio -> this
      // wrapper -> <a> -> <Image fill>) reaches the creative; without it the ad
      // image collapses to ~0px and isn't visible/clickable.
      className="h-full w-full"
      // Record the click but let the native link navigate (capture phase so it
      // fires before navigation; we never preventDefault — no popup, no broken link).
      onClickCapture={() => {
        void recordAdClick(adId)
      }}
    >
      {children}
    </div>
  )
}

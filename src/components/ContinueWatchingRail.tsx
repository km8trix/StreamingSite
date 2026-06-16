'use client'

import { useState, useSyncExternalStore, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { ContinueWatchingItem } from '@/lib/data'
import {
  getGuestProgressServerSnapshot,
  getGuestProgressSnapshot,
  removeGuestShow,
  subscribeGuestProgress,
} from '@/lib/watch/guest-store'
import { dismissContinueWatching } from '@/lib/watch/actions'
import { ContinueWatchingCard } from './ContinueWatchingCard'

/**
 * ContinueWatchingRail — the resume rail at the top of the home page.
 *
 * Two data sources behind one UI:
 *   - signed-in  → `items` are fetched server-side from the DB and rendered
 *     immediately (no hydration gap);
 *   - guest      → `items` is empty on the server; we read localStorage after
 *     mount (the server can't see it), so the rail fills in client-side.
 *
 * Renders nothing when there's no progress, so it never reserves empty space.
 */
export function ContinueWatchingRail({
  items,
  isSignedIn,
}: {
  items: ContinueWatchingItem[]
  isSignedIn: boolean
}) {
  const router = useRouter()
  // Guests: subscribe to localStorage (server snapshot is empty, so SSR renders
  // nothing and the client fills it in after hydration — no setState-in-effect).
  const guestList = useSyncExternalStore(
    subscribeGuestProgress,
    getGuestProgressSnapshot,
    getGuestProgressServerSnapshot,
  )
  // Optimistically-removed show ids (covers both the DB and guest paths without
  // mirroring server props into state).
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set())
  const [, startTransition] = useTransition()

  // Signed-in reads the server prop directly (reflects router.refresh()); guests
  // read localStorage. Either way, drop anything just dismissed.
  const source = isSignedIn ? items : guestList

  // Forget dismissed ids once they leave the source (their removal has landed),
  // so the set can't grow unbounded and a later re-watch can resurface the show.
  // React's "adjust state during render" pattern — terminates after one pass.
  if (dismissed.size > 0) {
    const stillPresent = [...dismissed].filter((id) =>
      source.some((i) => i.showId === id),
    )
    if (stillPresent.length !== dismissed.size) {
      setDismissed(new Set(stillPresent))
    }
  }

  const list = source.filter((i) => !dismissed.has(i.showId))

  function handleDismiss(showId: string) {
    setDismissed((prev) => new Set(prev).add(showId)) // optimistic
    if (isSignedIn) {
      startTransition(() => {
        dismissContinueWatching(showId)
          .then(() => router.refresh())
          .catch(() => {})
      })
    } else {
      removeGuestShow(showId)
    }
  }

  if (list.length === 0) return null

  return (
    <section aria-labelledby="continue-watching-heading" className="mb-10">
      <h2
        id="continue-watching-heading"
        className="mb-3 text-lg font-bold tracking-tight text-foreground sm:text-xl"
      >
        Continue Watching
      </h2>
      <ul
        className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2"
        data-testid="continue-watching-rail"
      >
        {list.map((item) => (
          <li
            key={item.showId}
            className="w-[60vw] shrink-0 snap-start sm:w-64 lg:w-72"
          >
            <ContinueWatchingCard
              item={item}
              onDismiss={() => handleDismiss(item.showId)}
            />
          </li>
        ))}
      </ul>
    </section>
  )
}

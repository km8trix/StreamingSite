'use client'

import { useState, useSyncExternalStore, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { WatchlistItem } from '@/lib/data'
import { removeFromWatchlist } from '@/lib/watch/actions'
import {
  getGuestWatchlistServerSnapshot,
  getGuestWatchlistSnapshot,
  removeGuestWatchlist,
  subscribeGuestWatchlist,
} from '@/lib/watch/watchlist-guest-store'
import { WatchlistCard } from './WatchlistCard'

/**
 * MyListRail — the "My List" (watchlist) rail on the home page. Mirrors
 * ContinueWatchingRail: signed-in users render the server `items` immediately;
 * guests read localStorage after mount (server snapshot is empty, so SSR renders
 * nothing and the client fills it in — no setState-in-effect).
 *
 * Renders nothing when the list is empty, so it never reserves empty space.
 */
export function MyListRail({
  items,
  isSignedIn,
}: {
  items: WatchlistItem[]
  isSignedIn: boolean
}) {
  const router = useRouter()
  const guestList = useSyncExternalStore(
    subscribeGuestWatchlist,
    getGuestWatchlistSnapshot,
    getGuestWatchlistServerSnapshot,
  )
  // Optimistically-removed show ids (covers both the DB and guest paths).
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set())
  const [, startTransition] = useTransition()

  const source = isSignedIn ? items : guestList

  // Forget removed ids once they leave the source (their removal has landed),
  // so the set can't grow unbounded. React's "adjust state during render".
  if (removed.size > 0) {
    const stillPresent = [...removed].filter((id) =>
      source.some((i) => i.showId === id),
    )
    if (stillPresent.length !== removed.size) {
      setRemoved(new Set(stillPresent))
    }
  }

  const list = source.filter((i) => !removed.has(i.showId))

  function handleRemove(showId: string) {
    setRemoved((prev) => new Set(prev).add(showId)) // optimistic
    if (isSignedIn) {
      // Revert the optimistic hide if the server delete fails, so the card
      // reappears immediately rather than only after a later refresh.
      const revert = () =>
        setRemoved((prev) => {
          const next = new Set(prev)
          next.delete(showId)
          return next
        })
      startTransition(() => {
        removeFromWatchlist(showId)
          .then((res) => (res.ok ? router.refresh() : revert()))
          .catch(revert)
      })
    } else {
      removeGuestWatchlist(showId)
    }
  }

  if (list.length === 0) return null

  return (
    <section aria-labelledby="my-list-heading" className="mb-10">
      <h2
        id="my-list-heading"
        className="mb-3 text-lg font-bold tracking-tight text-foreground sm:text-xl"
      >
        My List
      </h2>
      <ul
        className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2"
        data-testid="my-list-rail"
      >
        {list.map((item) => (
          <li
            key={item.showId}
            className="w-[60vw] shrink-0 snap-start sm:w-64 lg:w-72"
          >
            <WatchlistCard item={item} onRemove={() => handleRemove(item.showId)} />
          </li>
        ))}
      </ul>
    </section>
  )
}

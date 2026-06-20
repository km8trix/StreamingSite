'use client'

import { useState, useSyncExternalStore, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Bookmark, Check, Loader2 } from 'lucide-react'
import { addToWatchlist, removeFromWatchlist } from '@/lib/watch/actions'
import {
  addGuestWatchlist,
  isGuestWatchlisted,
  removeGuestWatchlist,
  subscribeGuestWatchlist,
} from '@/lib/watch/watchlist-guest-store'
import { cn } from '@/lib/utils'

/**
 * WatchlistButton — save/remove a show from "My List", on the show detail page.
 *
 * Two data sources behind one toggle:
 *   - signed-in → optimistic local state seeded from the server (initialSaved),
 *     persisted via addToWatchlist / removeFromWatchlist (reverts on failure);
 *   - guest     → membership read from localStorage (server snapshot = false, so
 *     SSR shows "Add" and the client upgrades after mount — no hydration error).
 *
 * Guests CAN save (kept in localStorage and merged to the DB on sign-in), so the
 * button never gates the action behind auth.
 */
export function WatchlistButton({
  show,
  isSignedIn,
  initialSaved = false,
}: {
  show: {
    id: string
    slug: string
    title: string
    coverImage: string
    year: number | null
  }
  isSignedIn: boolean
  initialSaved?: boolean
}) {
  const router = useRouter()
  const guestSaved = useSyncExternalStore(
    subscribeGuestWatchlist,
    () => isGuestWatchlisted(show.id),
    () => false,
  )
  const [savedSignedIn, setSavedSignedIn] = useState(initialSaved)
  const [pending, startTransition] = useTransition()

  const saved = isSignedIn ? savedSignedIn : guestSaved

  function toggle() {
    if (isSignedIn) {
      const next = !savedSignedIn
      setSavedSignedIn(next) // optimistic
      startTransition(() => {
        const op = next ? addToWatchlist(show.id) : removeFromWatchlist(show.id)
        op
          .then((res) => {
            if (!res.ok) setSavedSignedIn(!next) // revert on failure
            else router.refresh()
          })
          .catch(() => setSavedSignedIn(!next))
      })
    } else if (guestSaved) {
      removeGuestWatchlist(show.id)
    } else {
      addGuestWatchlist({
        showId: show.id,
        slug: show.slug,
        title: show.title,
        coverImage: show.coverImage,
        year: show.year,
        addedAt: new Date().toISOString(),
      })
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={saved}
      data-testid="watchlist-button"
      data-saved={saved ? 'true' : 'false'}
      title={saved ? 'Remove from My List' : 'Add to My List'}
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        saved
          ? 'border-accent bg-accent/15 text-accent-strong hover:bg-accent/25'
          : 'border-border bg-surface text-foreground hover:border-border-strong hover:bg-card-hover',
      )}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : saved ? (
        <Check className="size-4" aria-hidden />
      ) : (
        <Bookmark className="size-4" aria-hidden />
      )}
      {saved ? 'In My List' : 'Add to My List'}
    </button>
  )
}

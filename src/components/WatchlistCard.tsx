'use client'

import Image from 'next/image'
import Link from 'next/link'
import { X } from 'lucide-react'
import type { WatchlistItem } from '@/lib/data'

/**
 * WatchlistCard — one saved-show tile for the "My List" rail: a 16:9 thumbnail,
 * the show title and year, and a remove button. Clicking the card opens the show
 * detail page. The remove button is a SIBLING of the Link (not nested) so the
 * markup stays valid.
 */
export function WatchlistCard({
  item,
  onRemove,
}: {
  item: WatchlistItem
  onRemove: () => void
}) {
  return (
    <div className="group relative">
      <Link
        href={`/shows/${item.slug}`}
        data-testid="watchlist-card"
        className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <div className="relative aspect-video w-full overflow-hidden rounded-card border border-border bg-card">
          <Image
            src={item.coverImage}
            alt=""
            fill
            sizes="(min-width: 1024px) 288px, (min-width: 640px) 256px, 60vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </div>

        <div className="mt-2">
          <p className="truncate text-sm font-semibold text-foreground" title={item.title}>
            {item.title}
          </p>
          {item.year != null && (
            <p className="truncate text-xs text-muted">{item.year}</p>
          )}
        </div>
      </Link>

      <button
        type="button"
        onClick={onRemove}
        data-testid="watchlist-remove"
        aria-label={`Remove ${item.title} from My List`}
        className="absolute right-2 top-2 grid size-7 place-items-center rounded-full border border-border bg-surface/90 text-muted opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent group-hover:opacity-100"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  )
}

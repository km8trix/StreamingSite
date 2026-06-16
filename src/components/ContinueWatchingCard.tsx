'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Play, X } from 'lucide-react'
import type { ContinueWatchingItem } from '@/lib/data'

/**
 * ContinueWatchingCard — one resume tile: a 16:9 thumbnail with a play overlay
 * and a progress bar, the show title, the resume episode, and a dismiss button.
 *
 * Clicking the card resumes via /shows/{slug}?ep=<episodeId>&t=<seconds>, which
 * the show page reads to pre-select the episode and seek the player. The dismiss
 * button is a SIBLING of the Link (not nested) so the markup stays valid.
 */
export function ContinueWatchingCard({
  item,
  onDismiss,
}: {
  item: ContinueWatchingItem
  onDismiss: () => void
}) {
  const pct =
    item.durationSeconds > 0
      ? Math.min(100, Math.round((item.positionSeconds / item.durationSeconds) * 100))
      : 0

  const resumeHref = `/shows/${item.slug}?ep=${encodeURIComponent(item.episodeId)}&t=${item.positionSeconds}`

  return (
    <div className="group relative">
      <Link
        href={resumeHref}
        data-testid="continue-watching-card"
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
          {/* Play affordance on hover/focus. */}
          <div className="absolute inset-0 grid place-items-center bg-black/0 transition-colors group-hover:bg-black/30">
            <span className="grid size-11 place-items-center rounded-full bg-accent/90 text-accent-foreground opacity-0 transition-opacity group-hover:opacity-100">
              <Play className="size-5 fill-current" aria-hidden />
            </span>
          </div>
          {/* Progress bar pinned to the bottom edge. */}
          <div className="absolute inset-x-0 bottom-0 h-1 bg-black/50">
            <div
              className="h-full bg-accent"
              style={{ width: `${pct}%` }}
              data-testid="continue-watching-progress"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${pct}% watched`}
            />
          </div>
        </div>

        <div className="mt-2">
          <p className="truncate text-sm font-semibold text-foreground" title={item.title}>
            {item.title}
          </p>
          <p className="truncate text-xs text-muted">
            Episode {item.episodeNumber}
            {item.episodeTitle ? ` · ${item.episodeTitle}` : ''}
          </p>
        </div>
      </Link>

      <button
        type="button"
        onClick={onDismiss}
        data-testid="continue-watching-dismiss"
        aria-label={`Remove ${item.title} from Continue Watching`}
        className="absolute right-2 top-2 grid size-7 place-items-center rounded-full border border-border bg-surface/90 text-muted opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent group-hover:opacity-100"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  )
}

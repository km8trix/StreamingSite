'use client'

import { useState } from 'react'
import type { ShowSummary, TopAnimeWindow } from '@/lib/data'
import { cn } from '@/lib/utils'
import { ShowCard } from './ShowCard'

const TABS: { key: TopAnimeWindow; label: string }[] = [
  { key: 'day', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
]

/**
 * TopAnimeSection — "Top Anime" ranked by engagement, with a Day/Week/Month
 * toggle. All three windows are pre-fetched server-side and passed in, so
 * switching is instant (no client fetch / loading state). Cards are numbered by
 * rank. Renders nothing only if every window is empty.
 */
export function TopAnimeSection({
  windows,
}: {
  windows: Record<TopAnimeWindow, ShowSummary[]>
}) {
  const [active, setActive] = useState<TopAnimeWindow>('week')
  const shows = windows[active]

  if (TABS.every((t) => windows[t.key].length === 0)) return null

  return (
    <section aria-labelledby="top-anime-heading">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2
          id="top-anime-heading"
          className="text-lg font-bold tracking-tight text-foreground sm:text-xl"
        >
          Top Anime
        </h2>
        <div
          role="group"
          aria-label="Top anime time window"
          className="inline-flex rounded-full border border-border bg-card p-0.5"
        >
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              aria-pressed={active === t.key}
              onClick={() => setActive(t.key)}
              data-testid={`top-anime-tab-${t.key}`}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-semibold transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                active === t.key
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted hover:text-foreground',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {shows.length === 0 ? (
        <p className="rounded-card border border-dashed border-border bg-card/40 px-4 py-8 text-center text-sm text-muted">
          No views in this window yet.
        </p>
      ) : (
        <ul
          className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2"
          data-testid="top-anime-rail"
        >
          {shows.map((show, i) => (
            <li
              key={show.id}
              className="relative w-[44vw] shrink-0 snap-start sm:w-44 lg:w-48"
            >
              <span
                aria-hidden
                className="absolute left-1 top-1 z-10 grid size-7 place-items-center rounded-full bg-accent text-sm font-extrabold tabular-nums text-accent-foreground shadow-[0_2px_8px_-2px_rgba(0,0,0,0.6)]"
              >
                {i + 1}
              </span>
              <ShowCard
                show={show}
                sizes="(min-width: 1024px) 192px, (min-width: 640px) 176px, 44vw"
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

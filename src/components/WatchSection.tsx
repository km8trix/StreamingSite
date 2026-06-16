'use client'

import { useMemo, useState } from 'react'
import { Captions, Mic, Play } from 'lucide-react'
import type { Episode } from '@/lib/data'
import { PlayerPlaceholder } from './PlayerPlaceholder'
import { VideoPlayer } from './VideoPlayer'
import { cn } from '@/lib/utils'

/**
 * WatchSection — the interactive watch experience on the show detail page.
 *
 * Owns the "active episode" state. Renders the real HLS <VideoPlayer> when the
 * active episode has a `videoUrl`, otherwise falls back to the existing
 * "Streaming coming soon" <PlayerPlaceholder> so both paths are always exercised
 * (most episodes are not seeded with a stream yet).
 *
 * The selector lets the viewer pick any episode. Episodes with a stream get a
 * play glyph; the rest are still selectable (they just show the placeholder),
 * which keeps the picker honest about which episodes are watchable.
 */
export function WatchSection({
  title,
  poster,
  episodes,
}: {
  title: string
  poster?: string | null
  episodes: Episode[]
}) {
  // Default to the first episode that actually has a stream; fall back to the
  // lowest-numbered episode (already sorted by the data layer) so there is
  // always an active selection even when nothing is seeded.
  const defaultId = useMemo(() => {
    const withVideo = episodes.find((e) => e.videoUrl)
    return withVideo?.id ?? episodes[0]?.id ?? null
  }, [episodes])

  const [activeId, setActiveId] = useState<string | null>(defaultId)

  const active =
    episodes.find((e) => e.id === activeId) ?? episodes[0] ?? null

  return (
    <section aria-label="Watch" data-testid="watch-section">
      {/* Reserved 16:9 box (no layout shift): the player and the placeholder
          both render into an aspect-video frame. */}
      {active?.videoUrl ? (
        <VideoPlayer
          // Key on the episode id so switching episodes always remounts the
          // player with a clean hls.js teardown/rebuild — two episodes can
          // legitimately share the same source URL.
          key={active.id}
          src={active.videoUrl}
          poster={poster}
          title={`${title} — Episode ${active.number}`}
        />
      ) : (
        <PlayerPlaceholder title={title} />
      )}

      {active && (
        <p className="mt-2 text-sm text-muted">
          <span className="font-semibold text-foreground">
            Episode {active.number}
          </span>
          {active.title ? ` · ${active.title}` : ''}
        </p>
      )}

      {episodes.length > 1 && (
        <div className="mt-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-subtle">
            Select an episode
          </h3>
          <div
            role="group"
            aria-label="Episode selector"
            data-testid="episode-select"
            className="flex flex-wrap gap-2"
          >
            {episodes.map((ep) => {
              const isActive = ep.id === active?.id
              const watchable = Boolean(ep.videoUrl)
              return (
                <button
                  key={ep.id}
                  type="button"
                  data-testid="episode-select-option"
                  data-episode-id={ep.id}
                  data-has-video={watchable ? 'true' : 'false'}
                  aria-pressed={isActive}
                  aria-current={isActive ? 'true' : undefined}
                  onClick={() => setActiveId(ep.id)}
                  title={
                    watchable
                      ? `Episode ${ep.number}: ${ep.title}`
                      : `Episode ${ep.number}: ${ep.title} (streaming coming soon)`
                  }
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm font-medium tabular-nums transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                    isActive
                      ? 'border-accent bg-accent/15 text-foreground'
                      : 'border-border bg-card text-muted hover:border-border-strong hover:bg-card-hover hover:text-foreground',
                  )}
                >
                  {watchable ? (
                    <Play
                      className="size-3 fill-accent text-accent"
                      aria-hidden
                    />
                  ) : null}
                  <span>{ep.number}</span>
                  <span className="flex items-center gap-1 text-subtle">
                    {ep.isSubbed && (
                      <Captions className="size-3" aria-label="Subbed" />
                    )}
                    {ep.isDubbed && (
                      <Mic className="size-3" aria-label="Dubbed" />
                    )}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}

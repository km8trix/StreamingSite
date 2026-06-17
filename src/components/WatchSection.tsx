'use client'

import { useCallback, useMemo, useState } from 'react'
import { Captions, Mic, Play } from 'lucide-react'
import type { Episode } from '@/lib/data'
import { recordWatchProgress } from '@/lib/watch/actions'
import { recordGuestProgress } from '@/lib/watch/guest-store'
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
 * Continue Watching: the player reports progress (throttled), which we persist —
 * to the DB via a server action when signed in, else to localStorage for guests.
 * When arrived at via a Continue Watching card (initialEpisodeId/Seconds), we
 * pre-select that episode and seek the player to the saved position.
 */
export function WatchSection({
  showId,
  slug,
  title,
  poster,
  coverImage,
  episodes,
  isSignedIn,
  initialEpisodeId,
  initialStartSeconds = 0,
}: {
  showId: string
  slug: string
  title: string
  poster?: string | null
  coverImage: string
  episodes: Episode[]
  isSignedIn: boolean
  initialEpisodeId?: string | null
  initialStartSeconds?: number
}) {
  // Pick the initial episode from a deep link. A plain "open this episode" link
  // (e.g. the Release Schedule's episode badge — no resume position) honors the
  // exact target even if it's not yet streamable, so you land on that episode.
  // A *resume* (initialStartSeconds>0, from a Continue Watching card) instead
  // falls back to the first playable episode so it never lands on the "streaming
  // coming soon" placeholder. Last resort: the target (so a single sourceless
  // show still selects something), else the first episode.
  const defaultId = useMemo(() => {
    const target = initialEpisodeId
      ? episodes.find((e) => e.id === initialEpisodeId)
      : undefined
    if (target && (target.videoUrl || initialStartSeconds === 0)) return target.id
    const withVideo = episodes.find((e) => e.videoUrl)
    return withVideo?.id ?? target?.id ?? episodes[0]?.id ?? null
  }, [episodes, initialEpisodeId, initialStartSeconds])

  const [activeId, setActiveId] = useState<string | null>(defaultId)

  const active =
    episodes.find((e) => e.id === activeId) ?? episodes[0] ?? null

  // Only seek for the episode we were deep-linked to resume; manual switches and
  // the auto-advanced "next episode" start at 0.
  const startSeconds =
    active && active.id === initialEpisodeId ? initialStartSeconds : 0

  const recordProgress = useCallback(
    (positionSeconds: number, durationSeconds: number) => {
      if (!active) return
      if (isSignedIn) {
        // Fire-and-forget: tracking must never block or break playback.
        recordWatchProgress(
          showId,
          active.id,
          positionSeconds,
          durationSeconds,
        ).catch(() => {})
      } else {
        recordGuestProgress({
          show: { id: showId, slug, title, coverImage },
          episode: { id: active.id, number: active.number, title: active.title },
          positionSeconds,
          durationSeconds,
          episodes: episodes.map((e) => ({
            id: e.id,
            number: e.number,
            title: e.title,
          })),
        })
      }
    },
    [active, isSignedIn, showId, slug, title, coverImage, episodes],
  )

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
          startSeconds={startSeconds}
          onProgress={recordProgress}
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

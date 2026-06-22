'use client'

import { useState } from 'react'
import { Play } from 'lucide-react'

/**
 * OfficialEmbed — an official YouTube IFrame for a title that streams LEGALLY on
 * YouTube (e.g. Muse Asia / Ani-One channels surfaced by AniList). `src` must be
 * a pre-validated youtube-nocookie /embed/ URL (see toYouTubeEmbedSrc); this
 * component does no parsing and never fabricates a player for owned content.
 *
 * Click-to-load facade: the YouTube player pulls ~900KB of scripts, so we render
 * a lightweight poster + play button and only inject the iframe on click (with
 * autoplay, so the click plays it). This keeps the player off the critical path —
 * it was the show page's LCP bottleneck. Reserved 16:9 box (no layout shift),
 * mirroring the AdSlot reserved-height discipline.
 */
export function OfficialEmbed({ src, title }: { src: string; title: string }) {
  const [active, setActive] = useState(false)
  // toYouTubeEmbedSrc yields either /embed/<id> or /embed/videoseries?list=<id>.
  const playSrc = `${src}${src.includes('?') ? '&' : '?'}autoplay=1`

  return (
    <div
      data-testid="official-embed"
      className="relative aspect-video w-full overflow-hidden rounded-card border border-border bg-surface"
    >
      {active ? (
        <iframe
          src={playSrc}
          title={`Watch ${title} on YouTube`}
          className="absolute inset-0 h-full w-full"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
          allowFullScreen
        />
      ) : (
        <button
          type="button"
          onClick={() => setActive(true)}
          aria-label={`Watch ${title} on YouTube`}
          className="group absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-surface to-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
        >
          <span className="flex size-16 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-lg transition-transform group-hover:scale-110">
            <Play className="size-7 fill-current" aria-hidden />
          </span>
          <span className="text-sm font-medium text-muted">Watch on YouTube</span>
        </button>
      )}
    </div>
  )
}

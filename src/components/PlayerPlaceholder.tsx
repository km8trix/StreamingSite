import { Play } from 'lucide-react'

/**
 * PlayerPlaceholder — a 16:9 stand-in for the real player (no video in M1).
 * Communicates that streaming is coming, without faking a control surface.
 */
export function PlayerPlaceholder({ title }: { title?: string }) {
  return (
    <div
      className="relative aspect-video w-full overflow-hidden rounded-card border border-border bg-surface"
      role="img"
      aria-label={
        title
          ? `Video player for ${title} — streaming coming soon`
          : 'Video player — streaming coming soon'
      }
      data-testid="player-placeholder"
    >
      {/* ambient backdrop */}
      <div className="absolute inset-0 bg-[radial-gradient(40rem_20rem_at_50%_120%,color-mix(in_oklab,var(--accent)_22%,transparent),transparent)]" />
      <div className="absolute inset-0 grid place-items-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="grid size-16 place-items-center rounded-full border border-border bg-card/80 backdrop-blur transition-transform">
            <Play className="size-7 translate-x-0.5 fill-accent text-accent" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">
              Streaming coming soon
            </p>
            <p className="text-xs text-muted">
              Playback launches in a future update.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

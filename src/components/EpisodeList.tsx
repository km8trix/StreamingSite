import { Captions, Mic } from 'lucide-react'
import type { Episode } from '@/lib/data'
import { cn } from '@/lib/utils'

function formatAirDate(iso: string | null): string | null {
  if (!iso) return null
  // Parse the Y/M/D parts explicitly so a bare 'YYYY-MM-DD' (spec-parsed as UTC
  // midnight) isn't shifted to the previous day for viewers west of UTC.
  const [year, month, day] = iso.split('-').map(Number)
  if (!year || !month || !day) return null
  const d = new Date(year, month - 1, day)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * EpisodeList — episode rows for the detail page: number, title, sub/dub
 * availability indicators, and air date. Renders fine for a single-episode
 * entry (the seed contains a movie).
 */
export function EpisodeList({ episodes }: { episodes: Episode[] }) {
  if (episodes.length === 0) {
    return (
      <p className="rounded-card border border-dashed border-border bg-card/40 px-4 py-8 text-center text-sm text-muted">
        No episodes listed yet.
      </p>
    )
  }

  return (
    <ol className="flex flex-col gap-1.5" data-testid="episode-list">
      {episodes.map((ep) => {
        const aired = formatAirDate(ep.airDate)
        return (
          <li key={ep.id}>
            <div
              className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 transition-colors hover:border-border-strong hover:bg-card-hover"
              data-testid="episode-row"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-md bg-surface text-sm font-semibold tabular-nums text-muted">
                {ep.number}
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {ep.title}
                </p>
                {aired && (
                  <p className="text-xs text-subtle">{aired}</p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                <AvailabilityChip
                  active={ep.isSubbed}
                  label="SUB"
                  icon={<Captions className="size-3" aria-hidden />}
                  tone="sub"
                />
                <AvailabilityChip
                  active={ep.isDubbed}
                  label="DUB"
                  icon={<Mic className="size-3" aria-hidden />}
                  tone="dub"
                />
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function AvailabilityChip({
  active,
  label,
  icon,
  tone,
}: {
  active: boolean
  label: string
  icon: React.ReactNode
  tone: 'sub' | 'dub'
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase',
        active
          ? tone === 'sub'
            ? 'bg-sub/15 text-sub'
            : 'bg-dub/15 text-dub'
          : 'bg-surface text-subtle/60 line-through',
      )}
      aria-label={`${label} ${active ? 'available' : 'unavailable'}`}
      title={`${label} ${active ? 'available' : 'unavailable'}`}
    >
      {icon}
      {label}
    </span>
  )
}

import { cn } from '@/lib/utils'

/**
 * SUB / DUB episode-count badges — a core, reusable requirement.
 *
 * - SUB is always shown (every catalogued show is subbed).
 * - DUB is shown only when dubEpisodes > 0; otherwise rendered greyed/"DUB 0"
 *   so the absence of a dub is explicit rather than ambiguous.
 *
 * Colors are semantic tokens: cyan = sub, pink = dub (see globals.css).
 */
export function SubDubBadges({
  subEpisodes,
  dubEpisodes,
  size = 'sm',
  className,
}: {
  subEpisodes: number
  dubEpisodes: number
  size?: 'sm' | 'md'
  className?: string
}) {
  const base = cn(
    'inline-flex items-center gap-1 rounded-md font-semibold uppercase tracking-wide tabular-nums',
    size === 'sm' ? 'px-1.5 py-0.5 text-[0.625rem]' : 'px-2 py-1 text-xs',
  )
  const hasDub = dubEpisodes > 0

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      <span
        className={cn(base, 'bg-sub text-sub-foreground')}
        aria-label={`${subEpisodes} subtitled episodes`}
        data-testid="badge-sub"
      >
        <span aria-hidden>SUB</span>
        {subEpisodes}
      </span>
      <span
        className={cn(
          base,
          hasDub
            ? 'bg-dub text-dub-foreground'
            : 'bg-card text-subtle ring-1 ring-inset ring-border',
        )}
        aria-label={
          hasDub ? `${dubEpisodes} dubbed episodes` : 'No dubbed episodes'
        }
        data-testid="badge-dub"
      >
        <span aria-hidden>DUB</span>
        {dubEpisodes}
      </span>
    </div>
  )
}

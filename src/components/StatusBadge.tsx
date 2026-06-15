import type { ShowStatus } from '@/lib/data'
import { cn } from '@/lib/utils'

const LABELS: Record<ShowStatus, string> = {
  airing: 'Airing',
  finished: 'Finished',
  upcoming: 'Upcoming',
}

/**
 * Small status pill (Airing / Finished / Upcoming). "Airing" gets a live green
 * dot to read as active at a glance.
 */
export function StatusBadge({
  status,
  className,
}: {
  status: ShowStatus
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-border bg-surface/80 px-2.5 py-1 text-xs font-medium text-muted',
        className,
      )}
      data-testid="status-badge"
    >
      {status === 'airing' && (
        <span className="relative flex size-1.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-airing opacity-75" />
          <span className="relative inline-flex size-1.5 rounded-full bg-airing" />
        </span>
      )}
      {LABELS[status]}
    </span>
  )
}

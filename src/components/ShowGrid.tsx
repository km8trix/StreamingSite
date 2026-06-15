import type { ShowSummary } from '@/lib/data'
import { cn } from '@/lib/utils'
import { ShowCard } from './ShowCard'

/**
 * ShowGrid — responsive grid of ShowCards (browse-all, empty-state aware).
 */
export function ShowGrid({
  shows,
  className,
  emptyMessage = 'No shows to display.',
}: {
  shows: ShowSummary[]
  className?: string
  emptyMessage?: string
}) {
  if (shows.length === 0) {
    return (
      <p className="rounded-card border border-dashed border-border bg-card/40 px-4 py-12 text-center text-sm text-muted">
        {emptyMessage}
      </p>
    )
  }

  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6',
        className,
      )}
      data-testid="show-grid"
    >
      {shows.map((show, i) => (
        <ShowCard key={show.id} show={show} priority={i < 6} />
      ))}
    </div>
  )
}

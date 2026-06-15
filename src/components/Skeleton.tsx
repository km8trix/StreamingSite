import { cn } from '@/lib/utils'

/** Skeleton — pulsing placeholder block used by loading states. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('animate-pulse rounded-card bg-card', className)}
      aria-hidden
    />
  )
}

/** A row of portrait card skeletons matching the carousel layout. */
export function CardRailSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div>
      <Skeleton className="mb-3 h-6 w-40 rounded-md" />
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="w-[44vw] shrink-0 sm:w-44 lg:w-48">
            <Skeleton className="aspect-[2/3] w-full" />
            <Skeleton className="mt-2 h-4 w-3/4 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  )
}

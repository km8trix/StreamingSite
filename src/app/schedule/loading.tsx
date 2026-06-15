import { Skeleton } from '@/components/Skeleton'

export default function ScheduleLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-baseline gap-4">
        <Skeleton className="h-8 w-52 rounded-md" />
        <Skeleton className="h-4 w-28 rounded-md" />
      </div>
      {/* Desktop 7-column skeleton */}
      <div className="hidden lg:grid lg:grid-cols-7 lg:gap-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-card border border-border bg-card/30 p-2">
            <Skeleton className="h-7 w-full rounded-md" />
            <Skeleton className="h-14 w-full rounded-md" />
          </div>
        ))}
      </div>
      {/* Mobile stacked skeleton */}
      <div className="flex flex-col gap-4 lg:hidden">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-card border border-border bg-card/30 p-2">
            <Skeleton className="h-7 w-32 rounded-md" />
            <Skeleton className="h-14 w-full rounded-md" />
          </div>
        ))}
      </div>
    </div>
  )
}

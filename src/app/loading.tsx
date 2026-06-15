import { CardRailSkeleton, Skeleton } from '@/components/Skeleton'

export default function HomeLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <Skeleton className="mb-10 h-64 w-full sm:h-72" />
      <div className="flex flex-col gap-10">
        <CardRailSkeleton />
        <CardRailSkeleton />
        <CardRailSkeleton />
      </div>
    </div>
  )
}

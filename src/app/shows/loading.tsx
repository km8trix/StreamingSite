import { Skeleton } from '@/components/Skeleton'

export default function BrowseLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-baseline justify-between gap-4">
        <Skeleton className="h-8 w-40 rounded-md" />
        <Skeleton className="h-4 w-20 rounded-md" />
      </div>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <Skeleton className="h-96 w-full shrink-0 lg:w-60 xl:w-64" />
        <div className="grid min-w-0 flex-1 grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="aspect-[2/3] w-full" />
              <Skeleton className="mt-2 h-4 w-3/4 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

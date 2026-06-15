import { Skeleton } from '@/components/Skeleton'

export default function ShowDetailLoading() {
  return (
    <div>
      <div className="border-b border-border">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10 md:flex-row md:gap-8 lg:px-8">
          <Skeleton className="aspect-[2/3] w-36 shrink-0 sm:w-44 lg:w-52" />
          <div className="flex flex-1 flex-col gap-4">
            <Skeleton className="h-10 w-2/3 rounded-md" />
            <Skeleton className="h-6 w-40 rounded-md" />
            <Skeleton className="h-6 w-56 rounded-md" />
            <Skeleton className="h-8 w-72 rounded-md" />
          </div>
        </div>
      </div>
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_22rem] lg:px-8">
        <div className="flex flex-col gap-8">
          <Skeleton className="aspect-video w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  )
}

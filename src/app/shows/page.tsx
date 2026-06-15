import type { Metadata } from 'next'
import { getAllShows } from '@/lib/data'
import { ShowGrid } from '@/components/ShowGrid'

export const metadata: Metadata = {
  title: 'Browse',
  description: 'Browse the full anime catalog.',
}

export default async function BrowsePage() {
  const shows = await getAllShows()

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
          Browse
        </h1>
        <span className="text-sm text-muted">{shows.length} shows</span>
      </div>
      <ShowGrid shows={shows} emptyMessage="The catalog is empty right now." />
    </div>
  )
}

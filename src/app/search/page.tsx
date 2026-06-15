import type { Metadata } from 'next'
import { Suspense } from 'react'
import {
  searchAndFilterShows,
  listGenres,
  listFilterYears,
  type ShowFilter,
  type AudioFilter,
  type ShowSort,
  type ShowStatus,
} from '@/lib/data'
import { ShowGrid } from '@/components/ShowGrid'
import { FilterPanel } from '@/components/FilterPanel'
import { Skeleton } from '@/components/Skeleton'

export const metadata: Metadata = {
  title: 'Search',
  description: 'Search and filter the anime catalog by title, genre, audio, status, year, and more.',
}

interface SearchPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function parseSearchParams(raw: Record<string, string | string[] | undefined>): ShowFilter {
  const get = (key: string): string | undefined => {
    const v = raw[key]
    return Array.isArray(v) ? v[0] : v
  }

  const q = get('q')?.trim()

  // genres may be a comma-separated string or multiple values
  const genresRaw = raw['genres']
  const genres = genresRaw
    ? (Array.isArray(genresRaw) ? genresRaw : [genresRaw])
        .flatMap((g) => g.split(','))
        .map((g) => g.trim())
        .filter(Boolean)
    : undefined

  const audio = get('audio') as AudioFilter | undefined
  const status = get('status') as ShowStatus | undefined
  const yearRaw = get('year')
  const year = yearRaw ? parseInt(yearRaw, 10) : undefined
  const sort = (get('sort') as ShowSort | undefined) ?? 'popularity'

  return {
    ...(q ? { query: q } : {}),
    ...(genres && genres.length > 0 ? { genres } : {}),
    ...(audio && audio !== 'any' ? { audio } : {}),
    ...(status ? { status } : {}),
    ...(year && !isNaN(year) ? { year } : {}),
    sort,
  }
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const rawParams = await searchParams
  const filter = parseSearchParams(rawParams)

  const [{ shows, total }, genres, years] = await Promise.all([
    searchAndFilterShows(filter),
    listGenres(),
    listFilterYears(),
  ])

  const q = typeof rawParams['q'] === 'string' ? rawParams['q'].trim() : ''
  const hasActiveFilters =
    q ||
    filter.genres?.length ||
    filter.audio ||
    filter.status ||
    filter.year

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Page heading */}
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
          {q ? (
            <>
              Results for{' '}
              <span className="text-accent-strong">&ldquo;{q}&rdquo;</span>
            </>
          ) : (
            'Search'
          )}
        </h1>
        <p
          className="mt-1 text-sm text-muted"
          data-testid="result-count"
        >
          {total === 0
            ? hasActiveFilters
              ? 'No shows match your filters.'
              : 'Enter a search term or apply filters to find shows.'
            : `${total} show${total === 1 ? '' : 's'} found`}
        </p>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* Filter panel — Suspense boundary so useSearchParams doesn't block */}
        <div className="w-full shrink-0 lg:w-60 xl:w-64">
          <Suspense fallback={<Skeleton className="h-96 w-full" />}>
            <FilterPanel genres={genres} years={years} />
          </Suspense>
        </div>

        {/* Results grid */}
        <div className="min-w-0 flex-1" data-testid="search-results">
          <ShowGrid
            shows={shows}
            emptyMessage={
              hasActiveFilters
                ? 'No shows match your current filters. Try adjusting or clearing them.'
                : 'Enter a search term or apply filters to find shows.'
            }
          />
        </div>
      </div>
    </div>
  )
}

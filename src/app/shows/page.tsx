import type { Metadata } from 'next'
import { searchAndFilterShows, listGenres, listFilterYears } from '@/lib/data'
import { ShowGrid } from '@/components/ShowGrid'
import { FilterPanel } from '@/components/FilterPanel'
import { AdSlot } from '@/components/AdSlot'
import { Pager } from '@/components/Pager'
import {
  parseFilterValues,
  parseShowFilter,
  parsePage,
  buildCatalogHref,
  CATALOG_PAGE_SIZE,
} from '@/lib/filters/parse'

// The single catalog surface: browsing AND ?q= search results live here (the
// /search route now redirects here). Reads searchParams + renders a
// weighted-random sidebar ad, so the route is dynamic.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Browse',
  description:
    'Browse and search the full anime catalog by title, genre, audio, status, and year.',
}

interface BrowsePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function BrowsePage({ searchParams }: BrowsePageProps) {
  const rawParams = await searchParams
  const filter = parseShowFilter(rawParams)
  const filterValues = parseFilterValues(rawParams)
  const page = parsePage(rawParams)

  const [{ shows, total }, genres, years] = await Promise.all([
    searchAndFilterShows(filter, { page, perPage: CATALOG_PAGE_SIZE }),
    listGenres(),
    listFilterYears(),
  ])

  const q = filter.query ?? ''
  const hasActiveFilters = Boolean(
    q || filter.genres?.length || filter.audio || filter.status || filter.year,
  )

  const countText =
    total === 0
      ? hasActiveFilters
        ? 'No shows match your filters.'
        : 'The catalog is empty right now.'
      : `${total} ${total === 1 ? 'show' : 'shows'} found`

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
          {q ? (
            <>
              Results for{' '}
              <span className="text-accent-strong">&ldquo;{q}&rdquo;</span>
            </>
          ) : (
            'Browse'
          )}
        </h1>
        <p className="mt-1 text-sm text-muted" data-testid="result-count">
          {countText}
        </p>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* Filter panel — current values are parsed on the server and passed as
            props (the panel never reads useSearchParams itself), so it stays
            interactive on a hard load with query params. It pushes to the
            current pathname, so the same component drives /shows and /genre. */}
        <div className="w-full shrink-0 lg:w-60 xl:w-64">
          <FilterPanel genres={genres} years={years} values={filterValues} />

          {/* Non-invasive sidebar ad below the filters — reserved height, no CLS. */}
          <div className="mt-6">
            <AdSlot placementKey="sidebar" />
          </div>
        </div>

        <div className="min-w-0 flex-1" data-testid="browse-results">
          <ShowGrid
            shows={shows}
            emptyMessage={
              hasActiveFilters
                ? 'No shows match your current filters. Try adjusting or clearing them.'
                : 'The catalog is empty right now.'
            }
          />
          <Pager
            page={page}
            total={total}
            perPage={CATALOG_PAGE_SIZE}
            hrefFor={(p) => buildCatalogHref('/shows', rawParams, p)}
          />
        </div>
      </div>
    </div>
  )
}

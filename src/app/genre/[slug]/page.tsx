import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  searchAndFilterShows,
  listGenres,
  listFilterYears,
  getGenreBySlug,
} from '@/lib/data'
import seed from '@/lib/data/seed.json'
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

type Params = { slug: string }

// Reads searchParams (filters) + renders a weighted-random sidebar ad.
export const dynamic = 'force-dynamic'

// Prerender every genre in the bundled seed at build time, and allow slugs that
// only exist in the live DB to render on demand too (dynamicParams = true).
// Path enumeration is derived from the bundled seed, never the live DB, so the
// build stays self-contained (mirrors shows/[slug]); an unknown slug 404s via
// getGenreBySlug/notFound() at request time.
export const dynamicParams = true

export async function generateStaticParams(): Promise<Params[]> {
  try {
    const genres = (seed.genres ?? []) as { slug: string }[]
    return genres.map((g) => ({ slug: g.slug }))
  } catch {
    // Never let path enumeration crash the build.
    return []
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>
}): Promise<Metadata> {
  const { slug } = await params
  const genre = await getGenreBySlug(slug)
  if (!genre) return { title: 'Genre not found' }

  return {
    title: `${genre.name} anime`,
    description: `Browse ${genre.name} anime — filter by audio, status, and year.`,
  }
}

interface GenrePageProps {
  params: Promise<Params>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function GenrePage({
  params,
  searchParams,
}: GenrePageProps) {
  const { slug } = await params
  const rawParams = await searchParams
  const filterValues = parseFilterValues(rawParams)
  const baseFilter = parseShowFilter(rawParams)
  const page = parsePage(rawParams)

  const [allGenres, years] = await Promise.all([listGenres(), listFilterYears()])
  const genre = allGenres.find((g) => g.slug === slug)
  if (!genre) notFound()

  // The route fixes the genre; the panel filters WITHIN it (sort/audio/status/
  // year) — so the genre is the page context, not a removable chip. genres: [slug]
  // is forced regardless of the URL, and the panel's Genre section is hidden.
  const filter = { ...baseFilter, genres: [slug] }
  const { shows, total } = await searchAndFilterShows(filter, {
    page,
    perPage: CATALOG_PAGE_SIZE,
  })

  const panelValues = { ...filterValues, genres: [] }
  const hasActiveFilters = Boolean(
    baseFilter.audio || baseFilter.status || baseFilter.year,
  )

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <nav
        aria-label="Breadcrumb"
        className="mb-3 flex items-center text-xs text-subtle"
      >
        <Link href="/" className="hover:text-foreground">
          Home
        </Link>
        <span className="mx-1.5" aria-hidden>
          /
        </span>
        <Link href="/shows" className="hover:text-foreground">
          Browse
        </Link>
        <span className="mx-1.5" aria-hidden>
          /
        </span>
        <span className="text-muted" aria-current="page">
          {genre.name}
        </span>
      </nav>

      <div className="mb-6 flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
          {genre.name}
          <span className="ml-2 text-base font-medium text-subtle">anime</span>
        </h1>
        <span className="text-sm text-muted" data-testid="result-count">
          {total} {total === 1 ? 'show' : 'shows'}
        </span>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="w-full shrink-0 lg:w-60 xl:w-64">
          {/* genres={[]} hides the panel's Genre section: the genre is fixed by
              the route, so the panel only narrows within it. */}
          <FilterPanel genres={[]} years={years} values={panelValues} />

          <div className="mt-6">
            <AdSlot placementKey="sidebar" />
          </div>
        </div>

        <div className="min-w-0 flex-1" data-testid="genre-results">
          <ShowGrid
            shows={shows}
            emptyMessage={
              hasActiveFilters
                ? `No ${genre.name} shows match your current filters.`
                : `No ${genre.name} shows yet.`
            }
          />
          <Pager
            page={page}
            total={total}
            perPage={CATALOG_PAGE_SIZE}
            hrefFor={(p) => buildCatalogHref(`/genre/${slug}`, rawParams, p)}
          />
        </div>
      </div>
    </div>
  )
}

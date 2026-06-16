// filters/parse.ts — URL query string → filter values + ShowFilter.
//
// Shared by /search, /shows, and /genre/[slug]. Parsing on the SERVER and
// passing the result into <FilterPanel> as props (rather than letting the panel
// read useSearchParams() itself) is what keeps the panel interactive on a hard
// load with query params: a client useSearchParams() read inside a Suspense
// boundary on a dynamic page leaves its router instance unable to navigate after
// hydration. See FilterPanel for the full rationale.

import type { AudioFilter, ShowFilter, ShowSort, ShowStatus } from '@/lib/data'
import type { FilterValues } from '@/components/FilterPanel'

export type RawSearchParams = Record<string, string | string[] | undefined>

// Catalog page size for the Browse/Genre grids. Set above the current seed size
// so pagination is dormant at today's scale (the Pager hides when total fits one
// page) but kicks in automatically as the catalog grows.
export const CATALOG_PAGE_SIZE = 48

/** First value for a key (query strings may repeat a key). */
export function getParam(raw: RawSearchParams, key: string): string | undefined {
  const v = raw[key]
  return Array.isArray(v) ? v[0] : v
}

/** Genres may arrive comma-separated and/or as repeated keys. */
export function parseGenres(raw: RawSearchParams): string[] {
  const genresRaw = raw['genres']
  if (!genresRaw) return []
  return (Array.isArray(genresRaw) ? genresRaw : [genresRaw])
    .flatMap((g) => g.split(','))
    .map((g) => g.trim())
    .filter(Boolean)
}

/**
 * Derive the current selections for the FilterPanel from the URL. Defaults
 * mirror the panel's "unset" states so an empty URL renders a pristine panel.
 */
export function parseFilterValues(raw: RawSearchParams): FilterValues {
  return {
    q: getParam(raw, 'q') ?? '',
    genres: parseGenres(raw),
    audio: (getParam(raw, 'audio') ?? 'any') as AudioFilter,
    status: (getParam(raw, 'status') ?? '') as ShowStatus | '',
    year: getParam(raw, 'year') ?? '',
    sort: (getParam(raw, 'sort') ?? 'popularity') as ShowSort,
  }
}

/**
 * Build the data-layer ShowFilter from the URL. Only meaningful (non-default)
 * keys are included so `searchAndFilterShows` receives a minimal filter.
 */
export function parseShowFilter(raw: RawSearchParams): ShowFilter {
  const get = (key: string): string | undefined => getParam(raw, key)

  const q = get('q')?.trim()
  const genres = parseGenres(raw)
  const audio = get('audio') as AudioFilter | undefined
  const status = get('status') as ShowStatus | undefined
  const yearRaw = get('year')
  const year = yearRaw ? parseInt(yearRaw, 10) : undefined
  const sort = (get('sort') as ShowSort | undefined) ?? 'popularity'

  return {
    ...(q ? { query: q } : {}),
    ...(genres.length > 0 ? { genres } : {}),
    ...(audio && audio !== 'any' ? { audio } : {}),
    ...(status ? { status } : {}),
    ...(year && !isNaN(year) ? { year } : {}),
    sort,
  }
}

/** Current 1-based page from the URL (`?page=`), clamped to >= 1. */
export function parsePage(raw: RawSearchParams): number {
  const p = parseInt(getParam(raw, 'page') ?? '1', 10)
  return Number.isFinite(p) && p >= 1 ? p : 1
}

/**
 * Build a catalog URL for a given page, preserving all current filter params
 * and dropping `page` for page 1 (so the canonical first page has a clean URL).
 */
export function buildCatalogHref(
  pathname: string,
  raw: RawSearchParams,
  page: number,
): string {
  const sp = new URLSearchParams()
  for (const [key, value] of Object.entries(raw)) {
    if (key === 'page') continue
    if (typeof value === 'string') sp.set(key, value)
    else if (Array.isArray(value)) value.forEach((v) => sp.append(key, v))
  }
  if (page > 1) sp.set('page', String(page))
  const qs = sp.toString()
  return qs ? `${pathname}?${qs}` : pathname
}

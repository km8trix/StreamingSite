// search.ts — Search & filter data access (Milestone 2, Phase 5).
//
// searchAndFilterShows(filter): case-insensitive title substring, OR-genre,
//   audio sub/dub filter, status/year exact match, sort with default popularity.
//   Returns { shows, total } where total = count of matches (pre-limit).
//
// listFilterYears(): distinct years (desc) for the year filter dropdown.
//
// Both honor the seed-fallback contract (in-memory when !isSupabaseConfigured()).

import { getPublicClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import seed from './seed.json'
import type {
  SearchSuggestion,
  ShowFilter,
  ShowFilterResult,
  ShowSummary,
  ShowStatus,
} from './types'

// Minimum query length to return any suggestions (blank / 1-char => []).
const MIN_SUGGEST_LEN = 2
// Default number of suggestions returned.
const DEFAULT_SUGGEST_LIMIT = 8

// ---------------------------------------------------------------------------
// Seed typing
// ---------------------------------------------------------------------------

type SeedShow = {
  id: string
  slug: string
  title: string
  coverImage: string
  subEpisodes: number
  dubEpisodes: number
  status: string
  year: number | null
  popularityScore: number
  updatedAt: string
  genres: { id: string; name: string; slug: string }[]
}

const SEED_SHOWS = seed.shows as SeedShow[]

function toSummary(s: SeedShow): ShowSummary {
  return {
    id: s.id,
    slug: s.slug,
    title: s.title,
    coverImage: s.coverImage,
    subEpisodes: s.subEpisodes,
    dubEpisodes: s.dubEpisodes,
    status: s.status as ShowStatus,
    year: s.year,
  }
}

// ---------------------------------------------------------------------------
// Supabase row type (summary columns only)
// ---------------------------------------------------------------------------

type ShowRow = {
  id: string
  slug: string
  title: string
  cover_image: string
  sub_episodes: number
  dub_episodes: number
  status: string
  year: number | null
  popularity_score: number
  updated_at: string
}

function mapRow(row: ShowRow): ShowSummary {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    coverImage: row.cover_image,
    subEpisodes: row.sub_episodes,
    dubEpisodes: row.dub_episodes,
    status: row.status as ShowStatus,
    year: row.year,
  }
}

const SHOW_COLUMNS =
  'id, slug, title, cover_image, sub_episodes, dub_episodes, status, year, popularity_score, updated_at'

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Search and filter shows with optional query, genre, audio, status, year
 * constraints and a sort order (default: popularity desc).
 *
 * Returns { shows, total } — total is the full match count (not capped by any
 * limit; the UI may paginate in a later milestone).
 *
 * Genre filter uses OR semantics: any show matching at least one selected genre
 * slug is included.
 */
export async function searchAndFilterShows(
  filter: ShowFilter,
  // Opt-in pagination. When omitted, ALL matches are returned (preserves the
  // original contract and the data-layer unit tests). `total` is always the full
  // pre-page match count so the UI can render a pager.
  paging?: { page: number; perPage: number },
): Promise<ShowFilterResult> {
  const { query, genres, audio, status, year, sort = 'popularity' } = filter

  // Seed-fallback path (in-memory filtering + sorting). Reused as the live-error
  // fallback too: a live query MUST NEVER throw out of this read fn — `next build`
  // calls it during static generation and the cloud DB may be empty / unmigrated
  // / unreachable. We log once and fall back to the seed result instead.
  if (!isSupabaseConfigured()) return seedSearchAndFilter(filter, paging)

  try {
    // -----------------------------------------------------------------------
    // Supabase path
    // -----------------------------------------------------------------------
    const supabase = await getPublicClient()

    // Genre filter via a robust two-step using base-table .in() calls (avoids
    // embedded-resource filter syntax). 1) resolve the selected slugs to genre
    // ids; 2) resolve those genre ids to the matching show ids.
    let genreShowIds: Set<string> | null = null
    if (genres && genres.length > 0) {
      const { data: genreRows, error: genreErr } = await supabase
        .from('genres')
        .select('id')
        .in('slug', genres)

      if (genreErr) throw genreErr
      const genreIds = (genreRows as { id: string }[]).map((r) => r.id)

      const { data: sgData, error: sgErr } = await supabase
        .from('show_genres')
        .select('show_id')
        .in('genre_id', genreIds)

      if (sgErr) throw sgErr
      genreShowIds = new Set(
        (sgData as { show_id: string }[]).map((r) => r.show_id),
      )
    }

    let q = supabase.from('shows').select(SHOW_COLUMNS, { count: 'exact' })

    // Title: case-insensitive substring via ilike
    if (query && query.trim().length > 0) {
      q = q.ilike('title', `%${query.trim()}%`)
    }

    // Genre: restrict to precomputed show_ids
    if (genreShowIds !== null) {
      q = q.in('id', Array.from(genreShowIds))
    }

    // Audio
    if (audio === 'sub') q = q.gt('sub_episodes', 0)
    if (audio === 'dub') q = q.gt('dub_episodes', 0)

    // Status
    if (status) q = q.eq('status', status)

    // Year
    if (year != null) q = q.eq('year', year)

    // Sort
    switch (sort) {
      case 'title':
        q = q.order('title', { ascending: true })
        break
      case 'recent':
        q = q.order('updated_at', { ascending: false })
        break
      case 'year':
        q = q.order('year', { ascending: false })
        break
      case 'popularity':
      default:
        q = q.order('popularity_score', { ascending: false })
    }

    // Opt-in page window. `count: 'exact'` (above) still reports the FULL match
    // count, so `total` is unaffected by the range.
    if (paging) {
      const from = (paging.page - 1) * paging.perPage
      q = q.range(from, from + paging.perPage - 1)
    }

    const { data, error, count } = await q

    if (error) throw error

    const shows = (data ?? []).map((r) => mapRow(r as ShowRow))
    return { shows, total: count ?? shows.length }
  } catch (err) {
    console.warn(
      '[data] searchAndFilterShows live query failed, falling back:',
      err,
    )
    return seedSearchAndFilter(filter, paging)
  }
}

// In-memory seed filter+sort — the seed-fallback result for searchAndFilterShows.
function seedSearchAndFilter(
  filter: ShowFilter,
  paging?: { page: number; perPage: number },
): ShowFilterResult {
  const { query, genres, audio, status, year, sort = 'popularity' } = filter
  let results = [...SEED_SHOWS]

  // Title: case-insensitive substring
  if (query && query.trim().length > 0) {
    const q = query.trim().toLowerCase()
    results = results.filter((s) => s.title.toLowerCase().includes(q))
  }

  // Genres: OR — show matches if any of its genre slugs is in the filter set
  if (genres && genres.length > 0) {
    const slugSet = new Set(genres)
    results = results.filter((s) => s.genres.some((g) => slugSet.has(g.slug)))
  }

  // Audio
  if (audio === 'sub') results = results.filter((s) => s.subEpisodes > 0)
  if (audio === 'dub') results = results.filter((s) => s.dubEpisodes > 0)

  // Status
  if (status) results = results.filter((s) => s.status === status)

  // Year
  if (year != null) results = results.filter((s) => s.year === year)

  // Sort
  results = sortSeed(results, sort)

  // `total` is the full match count; slice to the requested page window when
  // pagination is requested (otherwise return all — the original contract).
  const total = results.length
  const paged = paging
    ? results.slice(
        (paging.page - 1) * paging.perPage,
        (paging.page - 1) * paging.perPage + paging.perPage,
      )
    : results
  return { shows: paged.map(toSummary), total }
}

/**
 * Lightweight search suggestions (typeahead) for an as-you-type box.
 *
 * Case-insensitive TITLE match over shows. Results are ranked so titles that
 * START WITH the query come first, then titles that merely CONTAIN it; within
 * each group, more popular shows rank higher. Returns a light payload
 * (slug/title/coverImage/year only) capped at `limit` (default 8).
 *
 * A blank or <2-char query returns [] (no work, no DB hit).
 *
 * Resilience contract: the live-Supabase branch is wrapped in try/catch and
 * falls back to the bundled seed (with a console.warn) — this fn NEVER throws,
 * so `next build` / a flaky live DB can't break a request.
 */
export async function getSearchSuggestions(
  query: string,
  limit: number = DEFAULT_SUGGEST_LIMIT,
): Promise<SearchSuggestion[]> {
  const q = (query ?? '').trim()
  if (q.length < MIN_SUGGEST_LEN) return []

  const cap = limit > 0 ? limit : DEFAULT_SUGGEST_LIMIT

  if (!isSupabaseConfigured()) return seedSuggestions(q, cap)

  try {
    const supabase = await getPublicClient()
    // Over-fetch a bit (cap * 3) so the starts-with/contains re-rank below has
    // candidates to promote, then trim to `cap`. `q` is passed to supabase-js
    // .ilike — parameterized + escaped by the driver — but we still trim/cap the
    // input upstream (route handler) and escape ilike wildcards here.
    const pattern = `%${escapeIlike(q)}%`
    const { data, error } = await supabase
      .from('shows')
      .select('slug, title, cover_image, year, popularity_score')
      .ilike('title', pattern)
      .order('popularity_score', { ascending: false })
      .limit(cap * 3)

    if (error) throw error

    const rows = (data ?? []) as SuggestRow[]
    const ranked = rankSuggestions(
      rows.map((r) => ({
        slug: r.slug,
        title: r.title,
        coverImage: r.cover_image,
        year: r.year,
        popularity: r.popularity_score,
      })),
      q,
    )
    return ranked.slice(0, cap).map(toSuggestion)
  } catch (err) {
    console.warn(
      '[data] getSearchSuggestions live query failed, falling back:',
      err,
    )
    return seedSuggestions(q, cap)
  }
}

type SuggestRow = {
  slug: string
  title: string
  cover_image: string
  year: number | null
  popularity_score: number
}

type RankableShow = {
  slug: string
  title: string
  coverImage: string
  year: number | null
  popularity: number
}

function toSuggestion(s: RankableShow): SearchSuggestion {
  return {
    slug: s.slug,
    title: s.title,
    coverImage: s.coverImage,
    year: s.year,
  }
}

// Escape the LIKE wildcards in a user query so e.g. "%"/"_" are matched
// literally (defense-in-depth; the value is already parameterized by the driver).
function escapeIlike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`)
}

// Rank: titles that START WITH the query first, then titles that CONTAIN it;
// ties broken by popularity desc, then title asc for stability.
function rankSuggestions(shows: RankableShow[], q: string): RankableShow[] {
  const ql = q.toLowerCase()
  return shows
    .map((s) => {
      const tl = s.title.toLowerCase()
      return { s, starts: tl.startsWith(ql) }
    })
    .sort((a, b) => {
      if (a.starts !== b.starts) return a.starts ? -1 : 1
      if (b.s.popularity !== a.s.popularity) return b.s.popularity - a.s.popularity
      return a.s.title.localeCompare(b.s.title)
    })
    .map((x) => x.s)
}

// In-memory seed suggestions — the seed-fallback result for getSearchSuggestions.
function seedSuggestions(q: string, cap: number): SearchSuggestion[] {
  const ql = q.toLowerCase()
  const matches: RankableShow[] = SEED_SHOWS.filter((s) =>
    s.title.toLowerCase().includes(ql),
  ).map((s) => ({
    slug: s.slug,
    title: s.title,
    coverImage: s.coverImage,
    year: s.year,
    popularity: s.popularityScore,
  }))
  return rankSuggestions(matches, q).slice(0, cap).map(toSuggestion)
}

/**
 * Returns distinct show years in descending order for the year filter dropdown.
 * Null years are excluded.
 */
export async function listFilterYears(): Promise<number[]> {
  if (!isSupabaseConfigured()) return seedFilterYears()

  try {
    const supabase = await getPublicClient()
    const { data, error } = await supabase
      .from('shows')
      .select('year')
      .not('year', 'is', null)
      .order('year', { ascending: false })

    if (error) throw error

    const seen = new Set<number>()
    const years: number[] = []
    for (const row of data ?? []) {
      const y = (row as { year: number | null }).year
      if (y != null && !seen.has(y)) {
        seen.add(y)
        years.push(y)
      }
    }
    return years
  } catch (err) {
    console.warn('[data] listFilterYears live query failed, falling back:', err)
    return seedFilterYears()
  }
}

// Distinct seed years (desc) — the seed-fallback result for listFilterYears.
function seedFilterYears(): number[] {
  const years = [
    ...new Set(
      SEED_SHOWS.map((s) => s.year).filter((y): y is number => y != null),
    ),
  ]
  return years.sort((a, b) => b - a)
}

// ---------------------------------------------------------------------------
// Internal: sort seed results
// ---------------------------------------------------------------------------

function sortSeed(
  shows: SeedShow[],
  sort: NonNullable<ShowFilter['sort']>,
): SeedShow[] {
  switch (sort) {
    case 'title':
      return shows.sort((a, b) => a.title.localeCompare(b.title))
    case 'recent':
      return shows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    case 'year':
      return shows.sort((a, b) => (b.year ?? 0) - (a.year ?? 0))
    case 'popularity':
    default:
      return shows.sort((a, b) => b.popularityScore - a.popularityScore)
  }
}

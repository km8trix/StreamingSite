// Data-access layer — the ONLY surface the UI reads from (COORDINATION.md).
//
// Each function:
//   - if Supabase is NOT configured -> reads/sorts/slices from bundled seed.json
//     (so the app fully builds & renders offline today);
//   - if Supabase IS configured     -> queries it and MAPS rows -> domain types.
//
// Raw DB rows never leak out of this file: all mapping lives in mapShowRow /
// mapEpisodeRow / mapGenreRow below.

import { getPublicClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import seed from './seed.json'
import type {
  Episode,
  Genre,
  ShowDetail,
  ShowStatus,
  ShowSummary,
} from './types'

const DEFAULT_LIMIT = 12

// ---------------------------------------------------------------------------
// Seed typing — seed.json holds full ShowDetail-shaped records.
// ---------------------------------------------------------------------------

type SeedShow = ShowDetail
const SEED_SHOWS = seed.shows as SeedShow[]
const SEED_GENRES = seed.genres as Genre[]

function toSummary(s: SeedShow | ShowDetail): ShowSummary {
  return {
    id: s.id,
    slug: s.slug,
    title: s.title,
    coverImage: s.coverImage,
    subEpisodes: s.subEpisodes,
    dubEpisodes: s.dubEpisodes,
    status: s.status,
    year: s.year,
  }
}

// ---------------------------------------------------------------------------
// Supabase row -> domain mappers (single source of truth for mapping).
// ---------------------------------------------------------------------------

function coerceStatus(value: string): ShowStatus {
  return value === 'airing' || value === 'upcoming' ? value : 'finished'
}

type ShowRow = {
  id: string
  slug: string
  title: string
  cover_image: string
  banner_image: string | null
  synopsis: string
  sub_episodes: number
  dub_episodes: number
  status: string
  year: number | null
  popularity_score: number
  updated_at: string
}

type EpisodeRow = {
  id: string
  number: number
  title: string
  is_subbed: boolean
  is_dubbed: boolean
  air_date: string | null
  video_url: string | null
}

function mapGenreRow(row: Genre): Genre {
  return { id: row.id, name: row.name, slug: row.slug }
}

function mapEpisodeRow(row: EpisodeRow): Episode {
  return {
    id: row.id,
    number: row.number,
    title: row.title,
    isSubbed: row.is_subbed,
    isDubbed: row.is_dubbed,
    airDate: row.air_date,
    videoUrl: row.video_url ?? null,
  }
}

function mapShowRowToSummary(row: ShowRow): ShowSummary {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    coverImage: row.cover_image,
    subEpisodes: row.sub_episodes,
    dubEpisodes: row.dub_episodes,
    status: coerceStatus(row.status),
    year: row.year,
  }
}

function mapShowRowToDetail(
  row: ShowRow,
  genres: Genre[],
  episodes: Episode[],
): ShowDetail {
  return {
    ...mapShowRowToSummary(row),
    synopsis: row.synopsis,
    bannerImage: row.banner_image,
    genres,
    episodes,
    popularityScore: row.popularity_score,
    updatedAt: row.updated_at,
  }
}

const SHOW_SUMMARY_COLUMNS =
  'id, slug, title, cover_image, sub_episodes, dub_episodes, status, year'

// ---------------------------------------------------------------------------
// Seed-fallback computations (single source of truth, reused by BOTH the
// "Supabase not configured" branch AND the live-error catch branch).
//
// Build resilience: a live query MUST NEVER throw out of these read functions.
// `next build` statically generates pages by calling them, and the cloud DB may
// be empty, missing migrations (PGRST205/PGRST125), or unreachable. We log once
// and fall back to the bundled seed so the build/render always succeeds.
// ---------------------------------------------------------------------------

function seedRecentlyUpdatedShows(limit: number): ShowSummary[] {
  return [...SEED_SHOWS]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, limit)
    .map(toSummary)
}

function seedPopularShows(limit: number): ShowSummary[] {
  return [...SEED_SHOWS]
    .sort((a, b) => b.popularityScore - a.popularityScore)
    .slice(0, limit)
    .map(toSummary)
}

function seedRecommendedShows(limit: number): ShowSummary[] {
  return [...SEED_SHOWS]
    .sort((a, b) => {
      // airing first, then by popularity
      const airBias = (s: SeedShow) => (s.status === 'airing' ? 1 : 0)
      const byAir = airBias(b) - airBias(a)
      if (byAir !== 0) return byAir
      return b.popularityScore - a.popularityScore
    })
    .slice(0, limit)
    .map(toSummary)
}

function seedAllShows(): ShowSummary[] {
  return [...SEED_SHOWS]
    .sort((a, b) => a.title.localeCompare(b.title))
    .map(toSummary)
}

function seedShowBySlug(slug: string): ShowDetail | null {
  const found = SEED_SHOWS.find((s) => s.slug === slug)
  if (!found) return null
  // seed records are already ShowDetail-shaped; return a fresh object.
  return {
    ...toSummary(found),
    synopsis: found.synopsis,
    bannerImage: found.bannerImage,
    genres: found.genres.map(mapGenreRow),
    episodes: [...found.episodes]
      .sort((a, b) => a.number - b.number)
      .map((e) => ({ ...e, videoUrl: e.videoUrl ?? null })),
    popularityScore: found.popularityScore,
    updatedAt: found.updatedAt,
  }
}

function seedGenres(): Genre[] {
  return [...SEED_GENRES]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(mapGenreRow)
}

// ---------------------------------------------------------------------------
// Public API (exact signatures from the contract).
// ---------------------------------------------------------------------------

export async function getRecentlyUpdatedShows(
  limit: number = DEFAULT_LIMIT,
): Promise<ShowSummary[]> {
  if (!isSupabaseConfigured()) return seedRecentlyUpdatedShows(limit)

  try {
    const supabase = await getPublicClient()
    const { data, error } = await supabase
      .from('shows')
      .select(SHOW_SUMMARY_COLUMNS)
      .order('updated_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return (data ?? []).map((r) => mapShowRowToSummary(r as ShowRow))
  } catch (err) {
    console.warn(
      '[data] getRecentlyUpdatedShows live query failed, falling back:',
      err,
    )
    return seedRecentlyUpdatedShows(limit)
  }
}

export async function getPopularShows(
  limit: number = DEFAULT_LIMIT,
): Promise<ShowSummary[]> {
  if (!isSupabaseConfigured()) return seedPopularShows(limit)

  try {
    const supabase = await getPublicClient()
    const { data, error } = await supabase
      .from('shows')
      .select(SHOW_SUMMARY_COLUMNS)
      .order('popularity_score', { ascending: false })
      .limit(limit)

    if (error) throw error
    return (data ?? []).map((r) => mapShowRowToSummary(r as ShowRow))
  } catch (err) {
    console.warn('[data] getPopularShows live query failed, falling back:', err)
    return seedPopularShows(limit)
  }
}

/**
 * Recommended (M1 heuristic): surface highly-rated shows that are NOT simply
 * the most popular — bias toward currently-airing titles, then fall back to
 * popularity. Deterministic so SSR is stable.
 */
export async function getRecommendedShows(
  limit: number = DEFAULT_LIMIT,
): Promise<ShowSummary[]> {
  if (!isSupabaseConfigured()) return seedRecommendedShows(limit)

  try {
    const supabase = await getPublicClient()
    const { data, error } = await supabase
      .from('shows')
      .select(`${SHOW_SUMMARY_COLUMNS}, popularity_score`)
      .order('status', { ascending: true }) // 'airing' < 'finished' < 'upcoming'
      .order('popularity_score', { ascending: false })
      .limit(limit)

    if (error) throw error
    return (data ?? []).map((r) => mapShowRowToSummary(r as ShowRow))
  } catch (err) {
    console.warn(
      '[data] getRecommendedShows live query failed, falling back:',
      err,
    )
    return seedRecommendedShows(limit)
  }
}

export async function getAllShows(): Promise<ShowSummary[]> {
  if (!isSupabaseConfigured()) return seedAllShows()

  try {
    const supabase = await getPublicClient()
    const { data, error } = await supabase
      .from('shows')
      .select(SHOW_SUMMARY_COLUMNS)
      .order('title', { ascending: true })

    if (error) throw error
    return (data ?? []).map((r) => mapShowRowToSummary(r as ShowRow))
  } catch (err) {
    console.warn('[data] getAllShows live query failed, falling back:', err)
    return seedAllShows()
  }
}

export async function getShowBySlug(slug: string): Promise<ShowDetail | null> {
  if (!isSupabaseConfigured()) return seedShowBySlug(slug)

  try {
    const supabase = await getPublicClient()
    const { data, error } = await supabase
      .from('shows')
      .select(
        `
        id, slug, title, cover_image, banner_image, synopsis,
        sub_episodes, dub_episodes, status, year, popularity_score, updated_at,
        show_genres ( genres ( id, name, slug ) ),
        episodes ( id, number, title, is_subbed, is_dubbed, air_date, video_url )
      `,
      )
      .eq('slug', slug)
      .maybeSingle()

    if (error) throw error
    if (!data) return null

    const row = data as unknown as ShowRow & {
      show_genres: { genres: Genre | null }[] | null
      episodes: EpisodeRow[] | null
    }

    const genres = (row.show_genres ?? [])
      .map((sg) => sg.genres)
      .filter((g): g is Genre => g != null)
      .map(mapGenreRow)

    const episodes = (row.episodes ?? [])
      .map(mapEpisodeRow)
      .sort((a, b) => a.number - b.number)

    return mapShowRowToDetail(row, genres, episodes)
  } catch (err) {
    console.warn('[data] getShowBySlug live query failed, falling back:', err)
    return seedShowBySlug(slug)
  }
}

export async function getRandomShow(): Promise<ShowSummary | null> {
  // Both paths reuse getAllShows() so behavior is identical online/offline.
  const all = await getAllShows()
  if (all.length === 0) return null
  const idx = Math.floor(Math.random() * all.length)
  return all[idx]
}

export async function listGenres(): Promise<Genre[]> {
  if (!isSupabaseConfigured()) return seedGenres()

  try {
    const supabase = await getPublicClient()
    const { data, error } = await supabase
      .from('genres')
      .select('id, name, slug')
      .order('name', { ascending: true })

    if (error) throw error
    return (data ?? []).map((r) => mapGenreRow(r as Genre))
  } catch (err) {
    console.warn('[data] listGenres live query failed, falling back:', err)
    return seedGenres()
  }
}

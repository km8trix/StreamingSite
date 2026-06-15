// Domain types — the data contract from COORDINATION.md.
// The UI consumes ONLY these shapes; raw Supabase rows never leak past the
// data layer (src/lib/data/shows.ts maps DB rows -> these types).

export type ShowStatus = 'airing' | 'finished' | 'upcoming'

export type Genre = {
  id: string
  name: string
  slug: string
}

export type ShowSummary = {
  id: string
  slug: string
  title: string
  coverImage: string // absolute URL
  subEpisodes: number // drives "SUB n" badge
  dubEpisodes: number // drives "DUB n" badge
  status: ShowStatus
  year: number | null
}

export type Episode = {
  id: string
  number: number
  title: string
  isSubbed: boolean
  isDubbed: boolean
  airDate: string | null // ISO date (YYYY-MM-DD) or null
}

export type ShowDetail = ShowSummary & {
  synopsis: string
  bannerImage: string | null
  genres: Genre[]
  episodes: Episode[]
  popularityScore: number
  updatedAt: string // ISO timestamp
}

// ---------------------------------------------------------------------------
// Milestone 2 — schedule + search/filter types
// ---------------------------------------------------------------------------

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6 // 0=Monday … 6=Sunday

export type ScheduleEntry = {
  show: ShowSummary
  dayOfWeek: DayOfWeek
  airTime: string   // 'HH:MM' 24h, in `timezone` (do NOT convert here — UI's job)
  timezone: string  // IANA, e.g. 'Asia/Tokyo'
}

export type ShowSort = 'title' | 'popularity' | 'recent' | 'year'

export type AudioFilter = 'any' | 'sub' | 'dub'

export type ShowFilter = {
  query?: string
  genres?: string[]     // genre slugs; OR semantics (match any selected)
  audio?: AudioFilter   // 'sub' => subEpisodes>0, 'dub' => dubEpisodes>0
  status?: ShowStatus
  year?: number
  sort?: ShowSort       // default 'popularity'
}

export type ShowFilterResult = { shows: ShowSummary[]; total: number }

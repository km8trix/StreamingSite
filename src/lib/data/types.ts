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

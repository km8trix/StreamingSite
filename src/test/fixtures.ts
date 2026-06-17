// Synthetic fixtures matching the data contract (COORDINATION.md / src/lib/data/types.ts).
// Component tests build their data from these so they never depend on the live seed.

import type {
  Episode,
  Genre,
  NewsArticle,
  ScheduleEntry,
  ShowDetail,
  ShowSummary,
} from '@/lib/data'

export const genreFixture: Genre = {
  id: 'genre-action',
  name: 'Action',
  slug: 'action',
}

export function makeShowSummary(
  overrides: Partial<ShowSummary> = {},
): ShowSummary {
  return {
    id: 'show-001',
    slug: 'cowboy-bebop',
    title: 'Cowboy Bebop',
    coverImage: 'https://cdn.example.com/cowboy-bebop.jpg',
    subEpisodes: 26,
    dubEpisodes: 26,
    status: 'finished',
    year: 1998,
    ...overrides,
  }
}

export function makeEpisode(overrides: Partial<Episode> = {}): Episode {
  return {
    id: 'ep-001',
    number: 1,
    title: 'Asteroid Blues',
    isSubbed: true,
    isDubbed: true,
    airDate: '1998-04-03',
    videoUrl: null,
    ...overrides,
  }
}

export function makeShowDetail(
  overrides: Partial<ShowDetail> = {},
): ShowDetail {
  const base = makeShowSummary()
  return {
    ...base,
    synopsis: 'A ragtag crew of bounty hunters chases its past.',
    bannerImage: null,
    genres: [genreFixture],
    episodes: [
      makeEpisode(),
      makeEpisode({ id: 'ep-002', number: 2, title: 'Stray Dog Strut' }),
    ],
    popularityScore: 95,
    updatedAt: '2026-06-01T00:00:00.000Z',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Milestone 2 — schedule fixtures
// ---------------------------------------------------------------------------

export function makeScheduleEntry(
  overrides: Partial<ScheduleEntry> = {},
): ScheduleEntry {
  return {
    show: makeShowSummary({ status: 'airing' }),
    dayOfWeek: 5, // Saturday (ISO: 0=Mon … 6=Sun)
    airTime: '17:00',
    timezone: 'Asia/Tokyo',
    ...overrides,
  }
}

export function makeNewsArticle(
  overrides: Partial<NewsArticle> = {},
): NewsArticle {
  return {
    id: 'news-001',
    slug: 'sample-headline',
    title: 'Sample Anime Headline',
    summary: 'A short summary of the sample headline.',
    source: 'Anime News Network',
    sourceUrl: 'https://www.animenewsnetwork.com',
    category: 'Industry',
    imageUrl: null,
    publishedAt: '2026-06-15T09:00:00.000Z',
    ...overrides,
  }
}

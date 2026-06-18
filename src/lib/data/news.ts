// news.ts — Anime news & headlines data access.
//
// getNews() returns curated headlines, newest-first.
//   - seed-fallback path: a bundled SEED_NEWS list (below).
//   - Supabase path: reads the public `news` table (migration 0012).
//
// News is curated, NOT derived from the Jikan/MAL API, so it lives here rather
// than in the generated seed.json/seed.sql (which scripts/build_seed.mjs
// overwrites). The `news` table is created AND seeded by migration 0012, so the
// live path has the same content in a real database.
//
// A live query MUST NEVER throw out of this read fn: `next build` calls it at
// render time and the cloud DB may be empty/unmigrated/unreachable — we log once
// and fall back to the seed.

import { getPublicClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import type { NewsArticle } from './types'

// ---------------------------------------------------------------------------
// Curated seed headlines (evergreen demo content). Keep in sync with the INSERT
// block in supabase/migrations/0012_news.sql. sourceUrl points at the outlet's
// homepage (a real https destination) rather than a fabricated article path.
// ---------------------------------------------------------------------------

const SEED_NEWS: NewsArticle[] = [
  {
    id: 'news-001',
    slug: 'summer-2026-season-preview',
    title: 'Summer 2026 Anime Season Preview: The Premieres to Watch',
    summary:
      'A rundown of the new series and returning favorites headlining the upcoming season, from blockbuster sequels to original debuts.',
    source: 'Anime News Network',
    sourceUrl: 'https://www.animenewsnetwork.com',
    category: 'New Anime',
    imageUrl: null,
    publishedAt: '2026-06-15T09:00:00.000Z',
  },
  {
    id: 'news-002',
    slug: 'studio-spotlight-reinvention',
    title: 'Studio Spotlight: How a Veteran Animation House Is Reinventing Itself',
    summary:
      'Inside a long-running studio’s push into new production pipelines and the staff betting on a bold next chapter.',
    source: 'Crunchyroll News',
    sourceUrl: 'https://www.crunchyroll.com/news',
    category: 'Industry',
    imageUrl: null,
    publishedAt: '2026-06-14T15:30:00.000Z',
  },
  {
    id: 'news-003',
    slug: 'shonen-manga-final-arc',
    title: 'Long-Running Shonen Manga Enters Its Final Arc',
    summary:
      'After more than a decade in serialization, the beloved series begins the storyline its author calls the true ending.',
    source: 'Anime News Network',
    sourceUrl: 'https://www.animenewsnetwork.com',
    category: 'Manga',
    imageUrl: null,
    publishedAt: '2026-06-13T12:00:00.000Z',
  },
  {
    id: 'news-004',
    slug: 'theatrical-anime-box-office-milestone',
    title: 'Theatrical Anime Crosses a Major Global Box-Office Milestone',
    summary:
      'Strong overseas demand pushes the latest theatrical release past a benchmark few anime films reach.',
    source: 'Crunchyroll News',
    sourceUrl: 'https://www.crunchyroll.com/news',
    category: 'Box Office',
    imageUrl: null,
    publishedAt: '2026-06-12T18:45:00.000Z',
  },
  {
    id: 'news-005',
    slug: 'fantasy-series-second-season-confirmed',
    title: 'Beloved Fantasy Series Confirmed for a Second Season',
    summary:
      'The announcement caps months of fan speculation, with the staff teasing an expanded world and new arcs.',
    source: 'Anime News Network',
    sourceUrl: 'https://www.animenewsnetwork.com',
    category: 'New Anime',
    imageUrl: null,
    publishedAt: '2026-06-11T10:15:00.000Z',
  },
  {
    id: 'news-006',
    slug: 'voice-cast-revealed-adaptation',
    title: 'Voice Cast Revealed for Upcoming Adaptation',
    summary:
      'The production unveils its principal cast alongside a first teaser visual ahead of the premiere window.',
    source: 'MyAnimeList News',
    sourceUrl: 'https://myanimelist.net/news',
    category: 'Industry',
    imageUrl: null,
    publishedAt: '2026-06-10T08:00:00.000Z',
  },
  {
    id: 'news-007',
    slug: 'streaming-simulcast-lineups-expand',
    title: 'Streaming Platforms Expand Simulcast Lineups for the New Season',
    summary:
      'More same-day releases mean international viewers can keep pace with Japan across a wider slate of titles.',
    source: 'Crunchyroll News',
    sourceUrl: 'https://www.crunchyroll.com/news',
    category: 'Industry',
    imageUrl: null,
    publishedAt: '2026-06-09T14:20:00.000Z',
  },
  {
    id: 'news-008',
    slug: 'award-season-standouts',
    title: 'Award Season: This Year’s Standout Series and Films',
    summary:
      'Critics and fans weigh in on the titles dominating this year’s nominations across categories.',
    source: 'Anime News Network',
    sourceUrl: 'https://www.animenewsnetwork.com',
    category: 'Events',
    imageUrl: null,
    publishedAt: '2026-06-07T11:00:00.000Z',
  },
]

type NewsRow = {
  id: string
  slug: string
  title: string
  summary: string | null
  source: string | null
  source_url: string
  category: string | null
  image_url: string | null
  published_at: string
}

/** Newest-first, optionally capped. Reused by the fallback branches. */
function seedNews(limit?: number): NewsArticle[] {
  const list = [...SEED_NEWS].sort((a, b) =>
    b.publishedAt.localeCompare(a.publishedAt),
  )
  return typeof limit === 'number' ? list.slice(0, limit) : list
}

/**
 * Returns curated anime news headlines, newest-first. Pass `limit` to cap the
 * count. Each article links OUT to its source (sourceUrl); we never host the
 * full article.
 */
export async function getNews(limit?: number): Promise<NewsArticle[]> {
  if (!isSupabaseConfigured()) return seedNews(limit)

  try {
    const supabase = await getPublicClient()
    let query = supabase
      .from('news')
      .select(
        'id, slug, title, summary, source, source_url, category, image_url, published_at',
      )
      .order('published_at', { ascending: false })
    if (typeof limit === 'number') query = query.limit(limit)

    const { data, error } = await query
    if (error) throw error

    const rows = (data ?? []) as NewsRow[]
    // An empty table almost always means "not seeded yet" — show curated news
    // rather than a bare page.
    if (rows.length === 0) return seedNews(limit)

    return rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      summary: r.summary ?? '',
      source: r.source ?? '',
      sourceUrl: r.source_url,
      category: r.category ?? '',
      imageUrl: r.image_url,
      publishedAt: r.published_at,
    }))
  } catch (err) {
    console.warn('[data] getNews live query failed, falling back:', err)
    return seedNews(limit)
  }
}

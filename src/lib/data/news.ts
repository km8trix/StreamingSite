// news.ts — Anime news & headlines (LiveChart-style live aggregator).
//
// getNews() aggregates real anime news from the Jikan API (MyAnimeList) across a
// handful of popular titles, newest-first. Each item links OUT to the real
// source article (myanimelist.net/news/…) and carries a real thumbnail
// (cdn.myanimelist.net). Results are cached (Next fetch revalidate) so we don't
// hammer Jikan, and a curated SEED_NEWS list is the offline fallback.
//
// A live query MUST NEVER throw out of this read fn: the cloud may be
// unreachable / rate-limited — we fall back to the seed.

import type { NewsArticle } from './types'

// Popular titles to aggregate news from (real MyAnimeList ids). News returned by
// /anime/{id}/news is editorial anime news related to that title.
const SOURCES: { malId: number; title: string }[] = [
  { malId: 52991, title: 'Frieren: Beyond Journey’s End' },
  { malId: 21, title: 'One Piece' },
  { malId: 16498, title: 'Attack on Titan' },
  { malId: 40748, title: 'Jujutsu Kaisen' },
  { malId: 52299, title: 'Solo Leveling' },
  { malId: 44511, title: 'Chainsaw Man' },
]

const JIKAN_BASE = 'https://api.jikan.moe/v4'
const REVALIDATE_SECONDS = 1800 // 30 min — Jikan news doesn't change minute-to-minute

type JikanNewsItem = {
  mal_id?: number
  url?: string
  title?: string
  date?: string
  excerpt?: string
  images?: { jpg?: { image_url?: string } }
}

function isHttps(url: unknown): url is string {
  return typeof url === 'string' && /^https:\/\//.test(url)
}

// next/image only optimizes allowlisted hosts (see next.config remotePatterns).
// Keep a thumbnail only if its host matches, so an off-host URL degrades to the
// placeholder instead of a 400 from the image optimizer.
function isAllowedImageHost(url: string): boolean {
  try {
    return new URL(url).hostname === 'cdn.myanimelist.net'
  } catch {
    return false
  }
}

function mapItem(
  item: JikanNewsItem,
  source: { malId: number; title: string },
): NewsArticle | null {
  if (!item.title || !isHttps(item.url) || !item.date) return null
  const rawImage = item.images?.jpg?.image_url
  const imageUrl =
    isHttps(rawImage) && isAllowedImageHost(rawImage) ? rawImage : null
  const summary = (item.excerpt ?? '').replace(/\s+/g, ' ').trim().slice(0, 220)
  return {
    id: `mal-${item.mal_id ?? item.url}`,
    slug: `mal-${item.mal_id ?? ''}`,
    title: item.title,
    summary,
    source: 'MyAnimeList',
    sourceUrl: item.url,
    category: source.title, // the title this story relates to (shown as a tag)
    imageUrl,
    publishedAt: item.date,
  }
}

async function fetchSourceNews(source: {
  malId: number
  title: string
}): Promise<NewsArticle[]> {
  const res = await fetch(`${JIKAN_BASE}/anime/${source.malId}/news`, {
    headers: { Accept: 'application/json' },
    // Cache + revalidate so repeated page loads don't re-hit Jikan.
    next: { revalidate: REVALIDATE_SECONDS },
  })
  if (!res.ok) return []
  const json = (await res.json()) as { data?: JikanNewsItem[] }
  const items = Array.isArray(json.data) ? json.data : []
  return items
    .map((it) => mapItem(it, source))
    .filter((a): a is NewsArticle => a !== null)
}

/** Newest-first, optionally capped. Reused by the fallback branch. */
function seedNews(limit?: number): NewsArticle[] {
  const list = [...SEED_NEWS].sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  )
  return typeof limit === 'number' ? list.slice(0, limit) : list
}

/**
 * Returns real anime news headlines, newest-first. Pass `limit` to cap the
 * count. Each article links OUT to its source (sourceUrl). Falls back to a
 * curated seed list when Jikan is unreachable.
 */
export async function getNews(limit = 24): Promise<NewsArticle[]> {
  try {
    const settled = await Promise.allSettled(SOURCES.map(fetchSourceNews))
    const all = settled.flatMap((r) =>
      r.status === 'fulfilled' ? r.value : [],
    )
    if (all.length === 0) return seedNews(limit)

    // Dedupe by article URL, newest-first.
    const seen = new Set<string>()
    const deduped = all.filter((a) => {
      if (seen.has(a.sourceUrl)) return false
      seen.add(a.sourceUrl)
      return true
    })
    deduped.sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
    )
    return deduped.slice(0, limit)
  } catch (err) {
    console.warn('[data] getNews live aggregation failed, falling back:', err)
    return seedNews(limit)
  }
}

// ---------------------------------------------------------------------------
// Offline fallback — curated evergreen headlines shown only when Jikan is
// unreachable. sourceUrl points at the outlet homepage (a real https
// destination); imageUrl is null so the card renders its placeholder thumbnail.
// ---------------------------------------------------------------------------

const SEED_NEWS: NewsArticle[] = [
  {
    id: 'news-001',
    slug: 'summer-2026-season-preview',
    title: 'Summer 2026 Anime Season Preview: The Premieres to Watch',
    summary:
      'A rundown of the new series and returning favorites headlining the upcoming season.',
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
      'Inside a long-running studio’s push into new production pipelines.',
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
      'After more than a decade in serialization, the beloved series begins its final storyline.',
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
      'Strong overseas demand pushes the latest theatrical release past a rare benchmark.',
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
      'The announcement caps months of fan speculation about an expanded world.',
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
      'The production unveils its principal cast alongside a first teaser visual.',
    source: 'MyAnimeList News',
    sourceUrl: 'https://myanimelist.net/news',
    category: 'Industry',
    imageUrl: null,
    publishedAt: '2026-06-10T08:00:00.000Z',
  },
]

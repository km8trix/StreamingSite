// where-to-watch.ts — "Where to watch" links from AniList (Milestone 1).
//
// getWhereToWatch(title) queries the AniList GraphQL API for a title's official
// streaming providers (externalLinks of type STREAMING) — Crunchyroll, Netflix,
// etc. — so the UI can link OUT to where a show is watched LEGALLY. Senpai never
// hosts or proxies video. Cached via Next fetch revalidate; this read fn NEVER
// throws (returns [] when AniList has nothing or is unreachable), mirroring the
// seed-fallback discipline in news.ts / schedule.ts.

import type { StreamingLink } from './types'

const ANILIST_ENDPOINT = 'https://graphql.anilist.co'
const REVALIDATE_SECONDS = 3600 // streaming availability changes slowly

const QUERY = `query ($search: String) {
  Media(search: $search, type: ANIME) {
    externalLinks { site url type }
  }
}`

type AniListLink = { site?: string; url?: string; type?: string }

function isHttps(url: unknown): url is string {
  return typeof url === 'string' && /^https:\/\//.test(url)
}

function isEmbeddable(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    return host === 'youtube.com' || host === 'youtu.be'
  } catch {
    return false
  }
}

/**
 * Official streaming providers for a title (legal "where to watch") from
 * AniList, deduped by provider. Returns [] when AniList has no match or is
 * unreachable — the UI shows a "no info yet" state.
 */
export async function getWhereToWatch(title: string): Promise<StreamingLink[]> {
  if (!title) return []
  try {
    const res = await fetch(ANILIST_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query: QUERY, variables: { search: title } }),
      next: { revalidate: REVALIDATE_SECONDS },
    })
    if (!res.ok) return []

    const json = (await res.json()) as {
      data?: { Media?: { externalLinks?: AniListLink[] | null } | null }
    }
    const links = json.data?.Media?.externalLinks
    if (!Array.isArray(links)) return []

    const seen = new Set<string>()
    const out: StreamingLink[] = []
    for (const l of links) {
      if (l?.type !== 'STREAMING' || !l.site || !isHttps(l.url)) continue
      if (seen.has(l.site)) continue
      seen.add(l.site)
      out.push({ site: l.site, url: l.url, embeddable: isEmbeddable(l.url) })
    }
    return out
  } catch (err) {
    console.warn('[data] getWhereToWatch failed:', err)
    return []
  }
}

// news.test.ts — getNews() live aggregation + seed fallback.
//
// getNews() aggregates Jikan (/anime/{id}/news) across several titles. We stub
// global fetch so these tests are deterministic and offline: a Jikan-shaped
// payload exercises mapping/dedupe/ordering; a failing fetch exercises the
// curated seed fallback.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { getNews } from './news'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

type JikanItem = Record<string, unknown>

function jikanOk(items: JikanItem[]) {
  return { ok: true, json: async () => ({ data: items }) }
}

function newsItem(overrides: JikanItem = {}): JikanItem {
  return {
    mal_id: 1,
    url: 'https://myanimelist.net/news/1',
    title: 'Headline',
    date: '2026-06-15T00:00:00+00:00',
    excerpt: 'An excerpt.',
    images: { jpg: { image_url: 'https://cdn.myanimelist.net/s/common/x.jpg' } },
    ...overrides,
  }
}

const idOf = (url: string) => Number(url.match(/anime\/(\d+)\/news/)?.[1] ?? 0)

describe('getNews — live aggregation', () => {
  it('maps Jikan items to articles, newest-first, deduped by URL', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const id = idOf(url)
      return jikanOk([
        newsItem({
          mal_id: id,
          url: `https://myanimelist.net/news/${id}`,
          title: `News ${id}`,
          date: `2026-06-1${id % 9}T00:00:00+00:00`,
        }),
        // Same URL across every source → must collapse to one.
        newsItem({
          mal_id: 99999,
          url: 'https://myanimelist.net/news/shared',
          title: 'Shared',
          date: '2026-06-01T00:00:00+00:00',
        }),
      ])
    })
    vi.stubGlobal('fetch', fetchMock)

    const articles = await getNews()
    expect(fetchMock).toHaveBeenCalled()
    expect(articles.length).toBeGreaterThan(0)

    // Mapping
    expect(articles.every((a) => a.source === 'MyAnimeList')).toBe(true)
    expect(
      articles.every((a) => /^https:\/\/myanimelist\.net\/news\//.test(a.sourceUrl)),
    ).toBe(true)

    // Deduped by URL
    const urls = articles.map((a) => a.sourceUrl)
    expect(new Set(urls).size).toBe(urls.length)
    expect(urls.filter((u) => u.endsWith('/shared'))).toHaveLength(1)

    // Newest-first
    const times = articles.map((a) => new Date(a.publishedAt).getTime())
    expect(times).toEqual([...times].sort((x, y) => y - x))
  })

  it('drops items without an https URL', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jikanOk([
          newsItem({ url: 'http://insecure.example/news/1', mal_id: 7 }),
          newsItem({ url: 'https://myanimelist.net/news/8', mal_id: 8 }),
        ]),
      ),
    )
    const articles = await getNews()
    expect(articles.every((a) => /^https:\/\//.test(a.sourceUrl))).toBe(true)
    expect(articles.some((a) => a.sourceUrl.startsWith('http://'))).toBe(false)
  })

  it('respects the limit argument', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const id = idOf(url)
        return jikanOk([
          newsItem({ mal_id: id, url: `https://myanimelist.net/news/${id}` }),
        ])
      }),
    )
    const limited = await getNews(2)
    expect(limited).toHaveLength(2)
  })

  it('drops thumbnails from non-allowlisted image hosts (→ placeholder)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const id = idOf(url)
        return jikanOk([
          newsItem({
            mal_id: id,
            url: `https://myanimelist.net/news/${id}-ok`,
            images: { jpg: { image_url: 'https://cdn.myanimelist.net/s/ok.jpg' } },
          }),
          newsItem({
            mal_id: id + 100000,
            url: `https://myanimelist.net/news/${id}-bad`,
            images: { jpg: { image_url: 'https://untrusted.example/x.jpg' } },
          }),
        ])
      }),
    )
    const articles = await getNews()
    // Allowlisted thumbnails are kept; off-host ones become null (placeholder).
    expect(
      articles
        .filter((a) => a.imageUrl !== null)
        .every((a) => /^https:\/\/cdn\.myanimelist\.net\//.test(a.imageUrl!)),
    ).toBe(true)
    expect(articles.some((a) => a.imageUrl === null)).toBe(true)
  })

  it('orders by true instant across mixed UTC offsets', async () => {
    // utc (2026-06-15T00:00Z) is newer than jp (2026-06-14T23:00Z) even though
    // jp sorts "newer" lexically — chronological order must win.
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const id = idOf(url)
        if (id === 21)
          return jikanOk([
            newsItem({
              mal_id: 21,
              url: 'https://myanimelist.net/news/jp',
              date: '2026-06-15T08:00:00+09:00',
            }),
          ])
        if (id === 16498)
          return jikanOk([
            newsItem({
              mal_id: 16498,
              url: 'https://myanimelist.net/news/utc',
              date: '2026-06-15T00:00:00+00:00',
            }),
          ])
        return jikanOk([])
      }),
    )
    const articles = await getNews()
    const jp = articles.findIndex((a) => a.sourceUrl.endsWith('/jp'))
    const utc = articles.findIndex((a) => a.sourceUrl.endsWith('/utc'))
    expect(utc).toBeGreaterThanOrEqual(0)
    expect(jp).toBeGreaterThanOrEqual(0)
    expect(utc).toBeLessThan(jp)
  })
})

describe('getNews — fallback', () => {
  it('falls back to the curated seed when every fetch fails (non-ok)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) })),
    )
    const articles = await getNews()
    expect(articles.length).toBeGreaterThan(0)
    expect(articles.every((a) => /^https:\/\//.test(a.sourceUrl))).toBe(true)
  })

  it('falls back to the curated seed when fetch throws', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down')
      }),
    )
    const articles = await getNews()
    expect(articles.length).toBeGreaterThan(0)
  })
})

// where-to-watch.test.ts — getWhereToWatch() AniList mapping + fallbacks.
// global fetch is stubbed so these tests are deterministic and offline.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { getWhereToWatch } from './where-to-watch'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

type Link = { site?: string; url?: string; type?: string }

function aniListOk(externalLinks: Link[]) {
  return {
    ok: true,
    json: async () => ({ data: { Media: { externalLinks } } }),
  }
}

describe('getWhereToWatch', () => {
  it('keeps STREAMING links only, deduped by site, https-only, marks YouTube embeddable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        aniListOk([
          { site: 'Crunchyroll', url: 'https://www.crunchyroll.com/series/x', type: 'STREAMING' },
          { site: 'Crunchyroll', url: 'https://www.crunchyroll.com/series/dup', type: 'STREAMING' },
          { site: 'YouTube', url: 'https://www.youtube.com/playlist?list=x', type: 'STREAMING' },
          { site: 'AniList', url: 'https://anilist.co/anime/1', type: 'INFO' },
          { site: 'Insecure', url: 'http://insecure.example/x', type: 'STREAMING' },
        ]),
      ),
    )
    const links = await getWhereToWatch('Frieren')
    expect(links.map((l) => l.site)).toEqual(['Crunchyroll', 'YouTube'])
    expect(links.find((l) => l.site === 'YouTube')?.embeddable).toBe(true)
    expect(links.find((l) => l.site === 'Crunchyroll')?.embeddable).toBe(false)
    expect(links.every((l) => /^https:\/\//.test(l.url))).toBe(true)
  })

  it('returns [] for an empty title without fetching', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect(await getWhereToWatch('')).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns [] on a non-ok response or no match', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })),
    )
    expect(await getWhereToWatch('Frieren')).toEqual([])

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ data: { Media: null } }) })),
    )
    expect(await getWhereToWatch('Nope')).toEqual([])
  })

  it('returns [] when fetch throws', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network')
      }),
    )
    expect(await getWhereToWatch('Frieren')).toEqual([])
  })
})

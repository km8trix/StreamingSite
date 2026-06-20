import { describe, expect, it } from 'vitest'
import sitemap from './sitemap'
import seed from '@/lib/data/seed.json'

describe('sitemap', () => {
  const entries = sitemap()
  const urls = entries.map((e) => e.url)

  it('includes the core static routes', () => {
    for (const path of ['/', '/shows', '/schedule', '/news', '/forum']) {
      const match = urls.some(
        (u) => u.endsWith(path) || (path === '/' && u.endsWith('/')),
      )
      expect(match, `missing ${path}`).toBe(true)
    }
  })

  it('emits one entry per seed show, at the right slugs', () => {
    const showUrls = urls.filter((u) => /\/shows\/[^/]+$/.test(u))
    expect(showUrls.length).toBe(seed.shows.length)
    expect(urls).toContain(
      `${new URL(urls[0]).origin}/shows/${seed.shows[0].slug}`,
    )
  })

  it('emits one entry per seed genre', () => {
    const genreUrls = urls.filter((u) => /\/genre\/[^/]+$/.test(u))
    expect(genreUrls.length).toBe(seed.genres.length)
  })

  it('emits only absolute https URLs', () => {
    for (const u of urls) expect(u).toMatch(/^https:\/\//)
  })

  it('does not use the senpai.example placeholder origin', () => {
    for (const u of urls) expect(u).not.toContain('senpai.example')
  })
})

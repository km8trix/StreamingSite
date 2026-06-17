// news.test.ts — getNews() seed-fallback behavior.
//
// With no Supabase env configured (the unit-test default), getNews() returns
// the bundled SEED_NEWS, newest-first. These tests pin the data contract the
// /news page and NewsCard rely on.

import { describe, expect, it } from 'vitest'
import { getNews } from './news'

describe('getNews (seed fallback)', () => {
  it('returns a non-empty list of articles', async () => {
    const articles = await getNews()
    expect(articles.length).toBeGreaterThan(0)
  })

  it('orders articles newest-first by publishedAt', async () => {
    const articles = await getNews()
    const times = articles.map((a) => new Date(a.publishedAt).getTime())
    const sorted = [...times].sort((a, b) => b - a)
    expect(times).toEqual(sorted)
  })

  it('respects the limit argument', async () => {
    const all = await getNews()
    const limited = await getNews(3)
    expect(limited).toHaveLength(Math.min(3, all.length))
    // The limited set is the newest N.
    expect(limited.map((a) => a.id)).toEqual(all.slice(0, 3).map((a) => a.id))
  })

  it('every article has the required shape and an https source URL', async () => {
    const articles = await getNews()
    for (const a of articles) {
      expect(a.id).toBeTruthy()
      expect(a.slug).toBeTruthy()
      expect(a.title).toBeTruthy()
      expect(typeof a.summary).toBe('string')
      expect(a.sourceUrl).toMatch(/^https:\/\//)
      expect(a.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    }
  })

  it('has unique ids and slugs', async () => {
    const articles = await getNews()
    expect(new Set(articles.map((a) => a.id)).size).toBe(articles.length)
    expect(new Set(articles.map((a) => a.slug)).size).toBe(articles.length)
  })
})

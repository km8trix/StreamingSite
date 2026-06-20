// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  addGuestWatchlist,
  clearGuestWatchlist,
  getGuestWatchlistServerSnapshot,
  getGuestWatchlistSnapshot,
  isGuestWatchlisted,
  readGuestWatchlist,
  readGuestWatchlistShowIds,
  removeGuestWatchlist,
} from './watchlist-guest-store'
import type { WatchlistItem } from '@/lib/data'

const STORAGE_KEY = 'senpai:watchlist:v1'

function item(id: string, over: Partial<WatchlistItem> = {}): WatchlistItem {
  return {
    showId: id,
    slug: `slug-${id}`,
    title: `Title ${id}`,
    coverImage: `https://img.example/${id}.jpg`,
    year: 2023,
    addedAt: new Date().toISOString(),
    ...over,
  }
}

beforeEach(() => window.localStorage.clear())
afterEach(() => window.localStorage.clear())

describe('addGuestWatchlist / isGuestWatchlisted', () => {
  it('saves a show and reports membership', () => {
    expect(isGuestWatchlisted('a')).toBe(false)
    addGuestWatchlist(item('a'))
    expect(isGuestWatchlisted('a')).toBe(true)
    expect(readGuestWatchlist()).toHaveLength(1)
    expect(readGuestWatchlist()[0]).toMatchObject({
      showId: 'a',
      slug: 'slug-a',
      title: 'Title a',
      year: 2023,
    })
  })

  it('is idempotent — one entry per show', () => {
    addGuestWatchlist(item('a'))
    addGuestWatchlist(item('a'))
    expect(readGuestWatchlist()).toHaveLength(1)
  })

  it('accepts a null year', () => {
    addGuestWatchlist(item('a', { year: null }))
    expect(readGuestWatchlist()[0].year).toBeNull()
  })
})

describe('removeGuestWatchlist', () => {
  it('removes a saved show', () => {
    addGuestWatchlist(item('a'))
    addGuestWatchlist(item('b'))
    removeGuestWatchlist('a')
    expect(isGuestWatchlisted('a')).toBe(false)
    expect(readGuestWatchlistShowIds()).toEqual(['b'])
  })

  it('is a no-op for an unknown show', () => {
    addGuestWatchlist(item('a'))
    removeGuestWatchlist('nope')
    expect(readGuestWatchlist()).toHaveLength(1)
  })
})

describe('readGuestWatchlist', () => {
  it('returns newest-first by addedAt', () => {
    // Write raw so we control addedAt (addGuestWatchlist stamps now()).
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        old: item('old', { addedAt: '2020-01-01T00:00:00.000Z' }),
        recent: item('recent', { addedAt: '2026-01-01T00:00:00.000Z' }),
      }),
    )
    expect(readGuestWatchlist().map((i) => i.showId)).toEqual(['recent', 'old'])
  })

  it('drops corrupt JSON and invalid entries (degrades to empty)', () => {
    window.localStorage.setItem(STORAGE_KEY, '{not json')
    expect(readGuestWatchlist()).toEqual([])

    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ bad: { showId: 'bad' }, good: item('good') }),
    )
    expect(readGuestWatchlistShowIds()).toEqual(['good'])
  })
})

describe('clearGuestWatchlist', () => {
  it('empties the whole list', () => {
    addGuestWatchlist(item('a'))
    addGuestWatchlist(item('b'))
    clearGuestWatchlist()
    expect(readGuestWatchlist()).toEqual([])
  })
})

describe('useSyncExternalStore adapters', () => {
  it('server snapshot is always empty', () => {
    expect(getGuestWatchlistServerSnapshot()).toEqual([])
  })

  it('client snapshot is referentially stable until the store changes', () => {
    addGuestWatchlist(item('a'))
    const first = getGuestWatchlistSnapshot()
    expect(getGuestWatchlistSnapshot()).toBe(first) // same ref, no change
    addGuestWatchlist(item('b'))
    expect(getGuestWatchlistSnapshot()).not.toBe(first) // ref changed
    expect(getGuestWatchlistSnapshot()).toHaveLength(2)
  })
})

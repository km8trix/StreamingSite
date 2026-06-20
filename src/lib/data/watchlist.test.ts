import { beforeEach, describe, expect, it } from 'vitest'
import { getWatchlist, isInWatchlist } from '@/lib/data'
import { isSupabaseConfigured } from '@/lib/supabase/config'

// The watchlist read side is DB-backed (per-user, RLS). With Supabase unset it
// must degrade to empty/false — never throw — so "My List" simply doesn't render
// rather than crashing the home or show page. (The live path is covered e2e.)

beforeEach(() => {
  expect(isSupabaseConfigured()).toBe(false)
})

describe('getWatchlist', () => {
  it('returns [] when Supabase is unconfigured', async () => {
    expect(await getWatchlist()).toEqual([])
  })

  it('respects an explicit limit without throwing', async () => {
    expect(await getWatchlist(5)).toEqual([])
  })
})

describe('isInWatchlist', () => {
  it('returns false when Supabase is unconfigured', async () => {
    expect(await isInWatchlist('show-001')).toBe(false)
  })

  it('returns false for an empty show id', async () => {
    expect(await isInWatchlist('')).toBe(false)
  })
})

// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  FINISHED_FRACTION,
  clearGuestProgress,
  getGuestProgressServerSnapshot,
  getGuestProgressSnapshot,
  readGuestMergeEntries,
  readGuestProgress,
  recordGuestProgress,
  removeGuestShow,
} from './guest-store'

const STORAGE_KEY = 'senpai:continue-watching:v1'

// A 3-episode show for advancement tests.
const EPISODES = [
  { id: 'e1', number: 1, title: 'One', isSubbed: true, isDubbed: false, airDate: null, videoUrl: 'x' },
  { id: 'e2', number: 2, title: 'Two', isSubbed: true, isDubbed: false, airDate: null, videoUrl: 'x' },
  { id: 'e3', number: 3, title: 'Three', isSubbed: true, isDubbed: false, airDate: null, videoUrl: 'x' },
]

const SHOW = {
  id: 'show-1',
  slug: 'frieren',
  title: 'Frieren',
  coverImage: 'https://img.example/cover.jpg',
}

function record(episodeIndex: number, position: number, duration: number) {
  recordGuestProgress({
    show: SHOW,
    episode: EPISODES[episodeIndex],
    positionSeconds: position,
    durationSeconds: duration,
    episodes: EPISODES,
  })
}

beforeEach(() => {
  window.localStorage.clear()
})
afterEach(() => {
  window.localStorage.clear()
})

describe('recordGuestProgress — in-progress', () => {
  it('stores the current episode + position when below the finish threshold', () => {
    record(0, 300, 1200) // 25%
    const list = readGuestProgress()
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({
      showId: 'show-1',
      slug: 'frieren',
      episodeId: 'e1',
      episodeNumber: 1,
      positionSeconds: 300,
      durationSeconds: 1200,
    })
  })

  it('treats unknown duration (0) as 0% — never "finished"', () => {
    record(0, 999, 0)
    expect(readGuestProgress()[0]).toMatchObject({
      episodeId: 'e1',
      positionSeconds: 999,
      durationSeconds: 0,
    })
  })

  it('clamps negative / non-finite values to 0', () => {
    record(0, -50, 1200)
    expect(readGuestProgress()[0].positionSeconds).toBe(0)
  })

  it('keeps exactly one entry per show (latest wins)', () => {
    record(0, 100, 1200)
    record(0, 400, 1200)
    const list = readGuestProgress()
    expect(list).toHaveLength(1)
    expect(list[0].positionSeconds).toBe(400)
  })
})

describe('recordGuestProgress — advancement at >=90%', () => {
  it('advances to the next episode at position 0', () => {
    record(0, 1140, 1200) // 95% of ep1
    const list = readGuestProgress()
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({
      episodeId: 'e2',
      episodeNumber: 2,
      positionSeconds: 0,
      durationSeconds: 0,
    })
  })

  it('uses exactly the 90% threshold (FINISHED_FRACTION)', () => {
    record(0, Math.ceil(1200 * FINISHED_FRACTION), 1200)
    expect(readGuestProgress()[0].episodeId).toBe('e2')
  })

  it('removes the show after finishing the LAST episode', () => {
    record(2, 1190, 1200) // 99% of ep3 (last)
    expect(readGuestProgress()).toHaveLength(0)
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('{}')
  })
})

describe('readGuestProgress — ordering + resilience', () => {
  it('returns entries newest-first by updatedAt', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        a: { showId: 'a', slug: 'a', title: 'A', coverImage: 'c', episodeId: 'e', episodeNumber: 1, episodeTitle: null, positionSeconds: 1, durationSeconds: 2, updatedAt: '2026-01-01T00:00:00.000Z' },
        b: { showId: 'b', slug: 'b', title: 'B', coverImage: 'c', episodeId: 'e', episodeNumber: 1, episodeTitle: null, positionSeconds: 1, durationSeconds: 2, updatedAt: '2026-06-01T00:00:00.000Z' },
      }),
    )
    expect(readGuestProgress().map((i) => i.showId)).toEqual(['b', 'a'])
  })

  it('returns [] for corrupt JSON', () => {
    window.localStorage.setItem(STORAGE_KEY, '{not valid json')
    expect(readGuestProgress()).toEqual([])
  })

  it('drops malformed entries (missing fields)', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ bad: { showId: 'bad' }, ok: { showId: 'ok', slug: 'ok', title: 'Ok', coverImage: 'c', episodeId: 'e', episodeNumber: 1, episodeTitle: null, positionSeconds: 1, durationSeconds: 2, updatedAt: '2026-01-01T00:00:00.000Z' } }),
    )
    expect(readGuestProgress().map((i) => i.showId)).toEqual(['ok'])
  })
})

describe('removeGuestShow / clearGuestProgress', () => {
  it('removes a single show', () => {
    record(0, 100, 1200)
    removeGuestShow('show-1')
    expect(readGuestProgress()).toHaveLength(0)
  })

  it('clears everything', () => {
    record(0, 100, 1200)
    clearGuestProgress()
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
  })
})

describe('readGuestMergeEntries', () => {
  it('returns just the id/position fields for the login flush', () => {
    record(0, 300, 1200)
    expect(readGuestMergeEntries()).toEqual([
      { showId: 'show-1', episodeId: 'e1', positionSeconds: 300, durationSeconds: 1200 },
    ])
  })
})

describe('useSyncExternalStore adapters', () => {
  it('server snapshot is a stable empty array', () => {
    const a = getGuestProgressServerSnapshot()
    expect(a).toEqual([])
    expect(getGuestProgressServerSnapshot()).toBe(a)
  })

  it('client snapshot is referentially stable until localStorage changes', () => {
    record(0, 100, 1200)
    const first = getGuestProgressSnapshot()
    expect(getGuestProgressSnapshot()).toBe(first) // unchanged -> same ref
    record(0, 200, 1200)
    expect(getGuestProgressSnapshot()).not.toBe(first) // changed -> new ref
  })
})

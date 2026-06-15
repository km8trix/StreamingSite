// schedule.test.ts — Milestone 2, Phase 4 data-layer tests.
//
// Exercises getWeeklySchedule() against the seed-fallback path only
// (no Supabase env configured). Guards the contract:
//   - Returns ScheduleEntry[]
//   - Each entry has a valid ShowSummary + dayOfWeek in 0..6 + 'HH:MM' airTime + timezone
//   - Only airing shows appear (count is seed-derived, not hardcoded)
//   - Slots are spread across MULTIPLE weekdays (enrichment populated all 7 days)
//   - airTime is NOT converted (stays JST) — conversion is the UI's job

import { beforeEach, describe, expect, it } from 'vitest'
import { getWeeklySchedule } from '@/lib/data'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import seed from '@/lib/data/seed.json'

// Derive expected airing show ids from seed for assertions.
const AIRING_SHOW_IDS = new Set(
  seed.shows.filter((s) => s.status === 'airing').map((s) => s.id),
)

// Derive the seeded slots dynamically (count grew from 2 → 17 after enrichment).
const SEED_SLOTS = (
  seed as typeof seed & {
    airingSlots: { id: string; showId: string; dayOfWeek: number; airTime: string; timezone: string }[]
  }
).airingSlots
const SEED_SLOT_SHOW_IDS = SEED_SLOTS.map((sl) => sl.showId)

// Distinct weekdays the seed slots fall on (enrichment spread them across the week).
const SEED_DISTINCT_DAYS = new Set(SEED_SLOTS.map((sl) => sl.dayOfWeek))

beforeEach(() => {
  // Guard: all assertions rely on the seed-fallback path.
  expect(isSupabaseConfigured()).toBe(false)
})

describe('getWeeklySchedule', () => {
  it('returns an array', async () => {
    const entries = await getWeeklySchedule()
    expect(Array.isArray(entries)).toBe(true)
  })

  it('returns at least one entry (seed has airing shows)', async () => {
    const entries = await getWeeklySchedule()
    expect(entries.length).toBeGreaterThanOrEqual(1)
  })

  it('returns exactly the seeded airing slot count', async () => {
    const entries = await getWeeklySchedule()
    // Count is seed-derived (currently 17 after enrichment), not hardcoded.
    expect(entries).toHaveLength(SEED_SLOT_SHOW_IDS.length)
  })

  it('spreads slots across MULTIPLE weekdays (enrichment populated the week)', async () => {
    const entries = await getWeeklySchedule()
    const daysWithEntries = new Set(entries.map((e) => e.dayOfWeek))
    // Returned entries must cover more than one weekday...
    expect(daysWithEntries.size).toBeGreaterThan(1)
    // ...and match exactly the distinct weekdays present in the seed.
    expect([...daysWithEntries].sort()).toEqual([...SEED_DISTINCT_DAYS].sort())
    // Sanity: every dayOfWeek is a valid ISO-week value (0..6).
    expect([...daysWithEntries].every((d) => d >= 0 && d <= 6)).toBe(true)
  })

  it('each entry has the correct ScheduleEntry shape', async () => {
    const entries = await getWeeklySchedule()
    for (const entry of entries) {
      // show is a ShowSummary
      expect(entry.show).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          slug: expect.any(String),
          title: expect.any(String),
          coverImage: expect.any(String),
          subEpisodes: expect.any(Number),
          dubEpisodes: expect.any(Number),
          status: expect.any(String),
        }),
      )
      // dayOfWeek in 0..6
      expect(entry.dayOfWeek).toBeGreaterThanOrEqual(0)
      expect(entry.dayOfWeek).toBeLessThanOrEqual(6)
      // airTime is 'HH:MM' 24h format
      expect(entry.airTime).toMatch(/^\d{2}:\d{2}$/)
      // timezone is a non-empty string (IANA)
      expect(typeof entry.timezone).toBe('string')
      expect(entry.timezone.length).toBeGreaterThan(0)
    }
  })

  it('show detail-only fields do not leak into the summary', async () => {
    const entries = await getWeeklySchedule()
    for (const { show } of entries) {
      expect(show).not.toHaveProperty('synopsis')
      expect(show).not.toHaveProperty('episodes')
      expect(show).not.toHaveProperty('genres')
      expect(show).not.toHaveProperty('popularityScore')
    }
  })

  it('only includes airing shows', async () => {
    const entries = await getWeeklySchedule()
    for (const entry of entries) {
      expect(entry.show.status).toBe('airing')
      expect(AIRING_SHOW_IDS.has(entry.show.id)).toBe(true)
    }
  })

  it('does NOT convert airTime from JST (stays in source timezone)', async () => {
    const entries = await getWeeklySchedule()
    // All seed slots are JST. airTime must match the raw seed value exactly.
    for (const entry of entries) {
      const seedSlot = (
        seed as typeof seed & {
          airingSlots: {
            showId: string
            airTime: string
            timezone: string
            dayOfWeek: number
          }[]
        }
      ).airingSlots.find((sl) => sl.showId === entry.show.id)
      expect(entry.airTime).toBe(seedSlot!.airTime)
      expect(entry.timezone).toBe(seedSlot!.timezone)
    }
  })

  it('dayOfWeek uses 0=Monday … 6=Sunday (ISO week) convention', async () => {
    const entries = await getWeeklySchedule()
    // Verify against raw seed: slot-001 is Saturday (5), slot-002 is Wednesday (2)
    const satEntry = entries.find((e) => e.show.id === 'show-002')
    const wedEntry = entries.find((e) => e.show.id === 'show-009')
    expect(satEntry?.dayOfWeek).toBe(5) // 0=Mon … 5=Sat
    expect(wedEntry?.dayOfWeek).toBe(2) // 0=Mon … 2=Wed
  })

  it('airTime is 24-hour HH:MM (not converted to AM/PM)', async () => {
    const entries = await getWeeklySchedule()
    // slot-002 has airTime=23:00 JST
    const lateEntry = entries.find((e) => e.airTime === '23:00')
    expect(lateEntry).toBeDefined()
    expect(lateEntry!.airTime).toBe('23:00')
  })
})

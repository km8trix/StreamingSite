// schedule.ts — Weekly air-slot data access (Milestone 2, Phase 4).
//
// getWeeklySchedule() returns every airing show's slot as a ScheduleEntry.
//   - seed-fallback path: reads bundled seed.json airingSlots + shows.
//   - Supabase path: joins airing_slots → shows and maps rows → domain types.
//
// IMPORTANT: airTime is always 'HH:MM' JST (Asia/Tokyo). TZ conversion to the
// viewer's local timezone is the UI's responsibility (use Intl.DateTimeFormat).

import { getServerClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import seed from './seed.json'
import type { DayOfWeek, ScheduleEntry, ShowSummary } from './types'

// ---------------------------------------------------------------------------
// Seed typing
// ---------------------------------------------------------------------------

type SeedAiringSlot = {
  id: string
  showId: string
  dayOfWeek: number
  airTime: string
  timezone: string
  season: string
}

type SeedShow = {
  id: string
  slug: string
  title: string
  coverImage: string
  subEpisodes: number
  dubEpisodes: number
  status: string
  year: number | null
}

const SEED_SLOTS = (seed as typeof seed & { airingSlots: SeedAiringSlot[] })
  .airingSlots
const SEED_SHOWS = seed.shows as SeedShow[]

// ---------------------------------------------------------------------------
// Supabase row type
// ---------------------------------------------------------------------------

type SlotRow = {
  id: string
  show_id: string
  day_of_week: number
  air_time: string
  timezone: string
  season: string
  shows: {
    id: string
    slug: string
    title: string
    cover_image: string
    sub_episodes: number
    dub_episodes: number
    status: string
    year: number | null
  } | null
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns all airing shows' weekly air slots as ScheduleEntry objects.
 * airTime is 'HH:MM' 24h in the slot's timezone (default 'Asia/Tokyo' / JST).
 * Do NOT convert timezone here — that is the UI's job at render time.
 */
export async function getWeeklySchedule(): Promise<ScheduleEntry[]> {
  if (!isSupabaseConfigured()) {
    return SEED_SLOTS.map((slot): ScheduleEntry => {
      const show = SEED_SHOWS.find((s) => s.id === slot.showId)
      if (!show) return null as unknown as ScheduleEntry
      const summary: ShowSummary = {
        id: show.id,
        slug: show.slug,
        title: show.title,
        coverImage: show.coverImage,
        subEpisodes: show.subEpisodes,
        dubEpisodes: show.dubEpisodes,
        status: show.status as ShowSummary['status'],
        year: show.year,
      }
      return {
        show: summary,
        dayOfWeek: slot.dayOfWeek as DayOfWeek,
        airTime: slot.airTime,
        timezone: slot.timezone,
      }
    }).filter((e): e is ScheduleEntry => e !== null)
  }

  const supabase = await getServerClient()
  const { data, error } = await supabase
    .from('airing_slots')
    .select(
      `id, show_id, day_of_week, air_time, timezone, season,
       shows ( id, slug, title, cover_image, sub_episodes, dub_episodes, status, year )`,
    )
    .order('day_of_week', { ascending: true })
    .order('air_time', { ascending: true })

  if (error) throw error

  return ((data ?? []) as SlotRow[])
    .map((row): ScheduleEntry | null => {
      if (!row.shows) return null
      const s = row.shows
      const summary: ShowSummary = {
        id: s.id,
        slug: s.slug,
        title: s.title,
        coverImage: s.cover_image,
        subEpisodes: s.sub_episodes,
        dubEpisodes: s.dub_episodes,
        status: s.status as ShowSummary['status'],
        year: s.year,
      }
      return {
        show: summary,
        dayOfWeek: row.day_of_week as DayOfWeek,
        airTime: row.air_time,
        timezone: row.timezone,
      }
    })
    .filter((e): e is ScheduleEntry => e !== null)
}

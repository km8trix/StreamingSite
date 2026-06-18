// ScheduleGrid.test.tsx — LiveChart-style day-timeline tests.
//
// ScheduleGrid is a 'use client' day timeline:
//   - container data-testid="schedule-grid"
//   - 7 day buttons (data-testid="schedule-day-tab", data-day=0..6, aria-pressed)
//     — the visible rolling week covers every ISO weekday exactly once
//   - a "Today" jump button (data-testid="schedule-today") appears once the
//     selection leaves today
//   - selecting a day shows THAT day's releases as rows. Each row
//     (data-testid="schedule-entry") has TWO links:
//       * the SHOW link (data-testid="schedule-show-link") → /shows/[slug]
//         wrapping the poster (data-testid="schedule-poster") + title + SUB/DUB
//       * the EPISODE link (data-testid="schedule-episode") → /shows/[slug]?ep=N
//     plus a live countdown chip (data-testid="schedule-countdown")
//   - empty day → data-testid="schedule-empty"
//   - a live "Now:" clock
//
// useSyncExternalStore resolves to the client snapshot under jsdom, so the
// component mounts past its SSR skeleton and renders the real timeline.
// TZ tests pin process.env.TZ so Intl output is deterministic.

import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeScheduleEntry } from '@/test/fixtures'

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => ({
    get: () => null,
    getAll: () => [],
    toString: () => '',
  }),
}))

const ORIGINAL_TZ = process.env.TZ

import { ScheduleGrid } from './ScheduleGrid'

afterEach(() => {
  if (ORIGINAL_TZ === undefined) delete process.env.TZ
  else process.env.TZ = ORIGINAL_TZ
  cleanup()
  vi.restoreAllMocks()
})

/** Click the day button matching an ISO dayOfWeek (0=Mon … 6=Sun). */
function selectDay(isoDay: number) {
  const tab = screen
    .getAllByTestId('schedule-day-tab')
    .find((t) => t.getAttribute('data-day') === String(isoDay))
  expect(tab).toBeTruthy()
  fireEvent.click(tab!)
}

describe('ScheduleGrid (timeline) — structure', () => {
  beforeEach(() => {
    process.env.TZ = 'Asia/Tokyo' // neutral — no conversion
  })

  it('renders the container', () => {
    render(<ScheduleGrid entries={[]} />)
    expect(screen.getByTestId('schedule-grid')).toBeInTheDocument()
  })

  it('renders 7 day buttons covering ISO weekdays 0..6', () => {
    render(<ScheduleGrid entries={[]} />)
    const tabs = screen.getAllByTestId('schedule-day-tab')
    expect(tabs).toHaveLength(7)
    const dayNums = [
      ...new Set(tabs.map((t) => t.getAttribute('data-day'))),
    ].sort()
    expect(dayNums).toEqual(['0', '1', '2', '3', '4', '5', '6'])
  })

  it('shows the live "Now" clock', () => {
    render(<ScheduleGrid entries={[]} />)
    expect(screen.getByTestId('schedule-grid').textContent).toContain('Now:')
  })

  it('shows the empty state when the selected day has no releases', () => {
    render(<ScheduleGrid entries={[]} />)
    expect(screen.getByTestId('schedule-empty')).toBeInTheDocument()
  })
})

describe('ScheduleGrid (timeline) — "Today" jump', () => {
  beforeEach(() => {
    process.env.TZ = 'Asia/Tokyo'
  })

  it('hides "Today" on first render and shows it after paging weeks', () => {
    render(<ScheduleGrid entries={[]} />)
    // Today (week 0, first button) is selected initially → no jump button.
    expect(screen.queryByTestId('schedule-today')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Next days' }))
    expect(screen.getByTestId('schedule-today')).toBeInTheDocument()
  })

  it('"Today" returns the selection to today (first day pressed)', () => {
    render(<ScheduleGrid entries={[]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Next days' }))
    fireEvent.click(screen.getByTestId('schedule-today'))

    const tabs = screen.getAllByTestId('schedule-day-tab')
    expect(tabs[0]).toHaveAttribute('aria-pressed', 'true')
    // Back on today → the jump button disappears again.
    expect(screen.queryByTestId('schedule-today')).not.toBeInTheDocument()
  })
})

describe('ScheduleGrid (timeline) — show vs episode links', () => {
  beforeEach(() => {
    process.env.TZ = 'Asia/Tokyo'
  })

  it('a row links to the show AND, separately, to that episode', () => {
    const entry = makeScheduleEntry({
      show: {
        id: 's-wed',
        slug: 'wed-show',
        title: 'Wednesday Show',
        coverImage: 'https://cdn.example.com/w.jpg',
        subEpisodes: 10,
        dubEpisodes: 0,
        status: 'airing',
        year: 2026,
      },
      dayOfWeek: 2, // Wednesday
    })
    render(<ScheduleGrid entries={[entry]} />)
    selectDay(2)

    const row = screen.getByTestId('schedule-entry')

    // SHOW link → /shows/wed-show, wraps poster + title.
    const showLink = within(row).getByTestId('schedule-show-link')
    expect(showLink).toHaveAttribute('href', '/shows/wed-show')
    expect(within(row).getByText('Wednesday Show')).toBeInTheDocument()
    expect(
      within(row).getByTestId('schedule-poster').querySelector('img'),
    ).toBeTruthy()
    // SUB/DUB badges reuse the app-wide component.
    expect(within(row).getByTestId('badge-sub')).toBeInTheDocument()

    // EPISODE link → /shows/wed-show?ep=11 (released 10 + 1), distinct target.
    const epLink = within(row).getByTestId('schedule-episode')
    expect(epLink).toHaveAttribute('href', '/shows/wed-show?ep=11')
    expect(epLink).toHaveTextContent(/EP\s*11/)

    // Countdown chip present.
    expect(within(row).getByTestId('schedule-countdown')).toBeInTheDocument()
  })

  it('the episode badge deep-links to the estimated next episode (released + 1)', () => {
    const entry = makeScheduleEntry({
      show: {
        id: 's-ep',
        slug: 'ep-show',
        title: 'Ep Show',
        coverImage: 'https://cdn.example.com/e.jpg',
        subEpisodes: 11,
        dubEpisodes: 0,
        status: 'airing',
        year: 2026,
      },
      dayOfWeek: 4,
    })
    render(<ScheduleGrid entries={[entry]} />)
    selectDay(4)
    const epLink = screen.getByTestId('schedule-episode')
    expect(epLink).toHaveTextContent(/EP\s*12/)
    expect(epLink).toHaveAttribute('href', '/shows/ep-show?ep=12')
  })

  it('does not leak an entry onto a different day', () => {
    const entry = makeScheduleEntry({ dayOfWeek: 5 }) // Saturday
    render(<ScheduleGrid entries={[entry]} />)
    selectDay(0) // Monday — different from Saturday
    expect(screen.getByTestId('schedule-empty')).toBeInTheDocument()
    expect(screen.queryByTestId('schedule-entry')).not.toBeInTheDocument()
  })
})

describe('ScheduleGrid (timeline) — timezone conversion', () => {
  it('converts JST 17:00 to 08:00 UTC and renders a local time', () => {
    process.env.TZ = 'UTC'
    const entry = makeScheduleEntry({
      airTime: '17:00',
      timezone: 'Asia/Tokyo',
      dayOfWeek: 5,
      show: {
        id: 's-tz',
        slug: 'tz-show',
        title: 'TZ Show',
        coverImage: 'https://cdn.example.com/t.jpg',
        subEpisodes: 1,
        dubEpisodes: 0,
        status: 'airing',
        year: 2026,
      },
    })
    render(<ScheduleGrid entries={[entry]} />)
    selectDay(5)
    // 17:00 JST = 08:00 UTC → the row's time gutter should read "8:00 AM".
    const row = screen.getByTestId('schedule-entry')
    expect(within(row).getByText(/8:00\s*AM/i)).toBeInTheDocument()
  })

  it('keeps a late JST air time on the correct calendar date (no day drift)', () => {
    process.env.TZ = 'UTC'
    // 23:00 JST = 14:00 UTC *that same day*. A naive mod-day correction would
    // push the instant to the next day; the <time> must carry the right date.
    const entry = makeScheduleEntry({
      airTime: '23:00',
      timezone: 'Asia/Tokyo',
      dayOfWeek: 0,
      show: {
        id: 's-late',
        slug: 'late-show',
        title: 'Late Show',
        coverImage: 'https://cdn.example.com/l.jpg',
        subEpisodes: 3,
        dubEpisodes: 0,
        status: 'airing',
        year: 2026,
      },
    })
    render(<ScheduleGrid entries={[entry]} />)
    selectDay(0)
    const timeEl = screen
      .getByTestId('schedule-entry')
      .querySelector('time') as HTMLTimeElement
    // 23:00 JST → 14:00:00Z; the ISO instant must end in T14:00:00.000Z.
    expect(timeEl.getAttribute('dateTime')).toMatch(/T14:00:00\.000Z$/)
  })
})

describe('ScheduleGrid (timeline) — viewer-local day bucketing', () => {
  // A US/Pacific viewer: a 1:00 AM JST *Monday* slot actually airs the prior
  // (Sunday) evening in Los Angeles, so it must bucket under Sunday, not Monday.
  beforeEach(() => {
    process.env.TZ = 'America/Los_Angeles'
  })

  it('buckets a late-night JST slot under the local day it airs, not its JST weekday', () => {
    const entry = makeScheduleEntry({
      airTime: '01:00',
      timezone: 'Asia/Tokyo',
      dayOfWeek: 0, // JST Monday
      show: {
        id: 's-tz2',
        slug: 'jst-late',
        title: 'JST Late',
        coverImage: 'https://cdn.example.com/j.jpg',
        subEpisodes: 4,
        dubEpisodes: 0,
        status: 'airing',
        year: 2026,
      },
    })
    render(<ScheduleGrid entries={[entry]} />)

    // NOT under the JST broadcast weekday (Monday, isoDay 0).
    selectDay(0)
    expect(screen.queryByTestId('schedule-entry')).not.toBeInTheDocument()

    // It appears under exactly one day — the viewer-local Sunday (isoDay 6).
    const tabs = screen.getAllByTestId('schedule-day-tab')
    let found = 0
    let foundDay = -1
    for (const t of tabs) {
      fireEvent.click(t)
      if (screen.queryByTestId('schedule-entry')) {
        found += 1
        foundDay = Number(t.getAttribute('data-day'))
      }
    }
    expect(found).toBe(1)
    expect(foundDay).toBe(6) // Sunday in Los Angeles
  })
})

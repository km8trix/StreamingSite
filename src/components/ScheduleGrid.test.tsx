// ScheduleGrid.test.tsx — day-picker layout tests.
//
// ScheduleGrid is a 'use client' day PICKER:
//   - container data-testid="schedule-grid"
//   - 7 day tabs (data-testid="schedule-day-tab", data-day=0..6) — the visible
//     rolling week covers every ISO weekday exactly once
//   - selecting a tab shows THAT day's releases as a list (one day at a time)
//   - each row: local time + title + estimated "Episode N" play pill, linking
//     to /shows/[slug]
//   - empty day → data-testid="schedule-empty"
//   - a live "Now:" clock
//
// useSyncExternalStore resolves to the client snapshot under jsdom, so the
// component mounts past its SSR skeleton and renders the real picker.
// TZ tests pin process.env.TZ so Intl output is deterministic.

import { render, screen, fireEvent, cleanup } from '@testing-library/react'
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

/** Click the day tab matching an ISO dayOfWeek (0=Mon … 6=Sun). */
function selectDay(isoDay: number) {
  const tab = screen
    .getAllByTestId('schedule-day-tab')
    .find((t) => t.getAttribute('data-day') === String(isoDay))
  expect(tab).toBeTruthy()
  fireEvent.click(tab!)
}

describe('ScheduleGrid (picker) — structure', () => {
  beforeEach(() => {
    process.env.TZ = 'Asia/Tokyo' // neutral — no conversion
  })

  it('renders the container', () => {
    render(<ScheduleGrid entries={[]} />)
    expect(screen.getByTestId('schedule-grid')).toBeInTheDocument()
  })

  it('renders 7 day tabs covering ISO weekdays 0..6', () => {
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

describe('ScheduleGrid (picker) — day selection', () => {
  beforeEach(() => {
    process.env.TZ = 'Asia/Tokyo'
  })

  it('shows a day’s entry after selecting that day', () => {
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
    expect(screen.getByText('Wednesday Show')).toBeInTheDocument()
    expect(screen.getByTestId('schedule-entry')).toHaveAttribute(
      'href',
      '/shows/wed-show',
    )
  })

  it('renders the estimated episode pill (released + 1)', () => {
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
    expect(screen.getByText(/Episode 12/)).toBeInTheDocument()
  })

  it('does not leak an entry onto a different day', () => {
    const entry = makeScheduleEntry({ dayOfWeek: 5 }) // Saturday
    render(<ScheduleGrid entries={[entry]} />)
    selectDay(0) // Monday — different from Saturday
    expect(screen.getByTestId('schedule-empty')).toBeInTheDocument()
    expect(screen.queryByTestId('schedule-entry')).not.toBeInTheDocument()
  })
})

describe('ScheduleGrid (picker) — timezone conversion', () => {
  it('converts JST 17:00 to 08:00 UTC and renders a time', () => {
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
    // 17:00 JST = 08:00 UTC → the row's time text should contain "8".
    expect(screen.getByTestId('schedule-entry').textContent ?? '').toMatch(/8/)
  })
})

// FilterPanel.test.tsx — Milestone 2, Phase 5 component tests.
//
// FilterPanel is a 'use client' component that reads/writes URL search params
// via next/navigation. We mock the three hooks (useRouter, useSearchParams,
// usePathname) and assert that:
//   - All control groups render from props
//   - Selecting a control triggers router.push with the correct query string
//   - Clear-filters removes non-query params and resets state
//
// All filter state lives in the URL; no internal React state to test.

import { render, screen, fireEvent } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Genre } from '@/lib/data'

// ---------------------------------------------------------------------------
// Mock next/navigation before importing the component.
// We use module-level mutable refs so individual tests can customise the
// searchParams while sharing a single mock module.
// ---------------------------------------------------------------------------

const mockPush = vi.fn()
const mockReplace = vi.fn()

// Mutable bag that tests may override to simulate URL state.
let mockParamBag: Record<string, string> = {}

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  usePathname: () => '/search',
  useSearchParams: () => ({
    get: (key: string) => mockParamBag[key] ?? null,
    getAll: (key: string) => (mockParamBag[key] ? [mockParamBag[key]] : []),
    toString: () => {
      const p = new URLSearchParams(mockParamBag)
      return p.toString()
    },
  }),
}))

// Import AFTER mock is registered.
import { FilterPanel } from './FilterPanel'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const GENRES: Genre[] = [
  { id: 'gen-001', name: 'Action', slug: 'action' },
  { id: 'gen-002', name: 'Drama', slug: 'drama' },
  { id: 'gen-003', name: 'Fantasy', slug: 'fantasy' },
]

const YEARS = [2026, 2025, 2024, 2023, 2022]

function renderPanel(
  paramBag: Record<string, string> = {},
  genres = GENRES,
  years = YEARS,
) {
  mockParamBag = paramBag
  return render(<FilterPanel genres={genres} years={years} />)
}

beforeEach(() => {
  mockPush.mockClear()
  mockReplace.mockClear()
  mockParamBag = {}
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

describe('FilterPanel rendering', () => {
  it('renders the filter panel landmark', () => {
    renderPanel()
    expect(screen.getByTestId('filter-panel')).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: /filter and sort/i })).toBeInTheDocument()
  })

  it('renders the Sort by section with all 4 options', () => {
    renderPanel()
    const sortGroup = screen.getByTestId('filter-sort')
    expect(sortGroup).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /popularity/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /title/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /recently updated/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /year/i })).toBeInTheDocument()
  })

  it('renders the Audio section with Any, SUB, DUB options', () => {
    renderPanel()
    const audioGroup = screen.getByTestId('filter-audio')
    expect(audioGroup).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /^any$/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /^sub$/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /^dub$/i })).toBeInTheDocument()
  })

  it('renders the Status section with All, Airing, Finished, Upcoming options', () => {
    renderPanel()
    expect(screen.getByTestId('filter-status')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /^all$/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /airing/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /finished/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /upcoming/i })).toBeInTheDocument()
  })

  it('renders the Year dropdown with all supplied years', () => {
    renderPanel()
    const yearSelect = screen.getByTestId('filter-year')
    expect(yearSelect).toBeInTheDocument()
    for (const year of YEARS) {
      expect(screen.getByRole('option', { name: String(year) })).toBeInTheDocument()
    }
    // Plus the "All years" default option
    expect(screen.getByRole('option', { name: /all years/i })).toBeInTheDocument()
  })

  it('renders genre checkboxes from the genres prop', () => {
    renderPanel()
    const genreGroup = screen.getByTestId('filter-genre')
    expect(genreGroup).toBeInTheDocument()
    for (const genre of GENRES) {
      const checkbox = screen.getByRole('checkbox', { name: genre.name })
      expect(checkbox).toBeInTheDocument()
    }
  })

  it('does not render year section when years array is empty', () => {
    renderPanel({}, GENRES, [])
    expect(screen.queryByTestId('filter-year')).not.toBeInTheDocument()
  })

  it('does not render genre section when genres array is empty', () => {
    renderPanel({}, [], YEARS)
    expect(screen.queryByTestId('filter-genre')).not.toBeInTheDocument()
  })

  it('defaults Sort to Popularity when URL has no sort param', () => {
    renderPanel()
    const popularityRadio = screen.getByRole('radio', { name: /popularity/i })
    expect(popularityRadio).toBeChecked()
  })

  it('defaults Audio to Any when URL has no audio param', () => {
    renderPanel()
    const anyRadio = screen.getByRole('radio', { name: /^any$/i })
    expect(anyRadio).toBeChecked()
  })

  it('does not show Clear button when no active filters', () => {
    renderPanel()
    expect(screen.queryByRole('button', { name: /clear/i })).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Sort interaction
// ---------------------------------------------------------------------------

describe('FilterPanel — sort interaction', () => {
  it('clicking Title sort calls router.push with sort=title', () => {
    renderPanel()
    const titleRadio = screen.getByRole('radio', { name: /title a–z/i })
    fireEvent.click(titleRadio)
    expect(mockPush).toHaveBeenCalledTimes(1)
    const url: string = mockPush.mock.calls[0][0]
    expect(url).toContain('sort=title')
  })

  it('clicking Recently Updated sort calls router.push with sort=recent', () => {
    renderPanel()
    fireEvent.click(screen.getByRole('radio', { name: /recently updated/i }))
    const url: string = mockPush.mock.calls[0][0]
    expect(url).toContain('sort=recent')
  })

  it('clicking Year sort calls router.push with sort=year', () => {
    renderPanel()
    fireEvent.click(screen.getByRole('radio', { name: /year \(newest\)/i }))
    const url: string = mockPush.mock.calls[0][0]
    expect(url).toContain('sort=year')
  })

  it('selecting Popularity sort from a different active sort calls router.push with sort=popularity', () => {
    // Start with title sort active so switching to popularity fires onChange.
    renderPanel({ sort: 'title' })
    fireEvent.click(screen.getByRole('radio', { name: /^popularity$/i }))
    expect(mockPush).toHaveBeenCalledTimes(1)
    const url: string = mockPush.mock.calls[0][0]
    expect(url).toContain('sort=popularity')
  })

  it('reflects an existing sort param from the URL', () => {
    renderPanel({ sort: 'title' })
    expect(screen.getByRole('radio', { name: /title a–z/i })).toBeChecked()
    expect(screen.getByRole('radio', { name: /^popularity$/i })).not.toBeChecked()
  })
})

// ---------------------------------------------------------------------------
// Audio interaction
// ---------------------------------------------------------------------------

describe('FilterPanel — audio interaction', () => {
  it('clicking SUB calls router.push with audio=sub', () => {
    renderPanel()
    fireEvent.click(screen.getByRole('radio', { name: /^sub$/i }))
    expect(mockPush).toHaveBeenCalledTimes(1)
    const url: string = mockPush.mock.calls[0][0]
    expect(url).toContain('audio=sub')
  })

  it('clicking DUB calls router.push with audio=dub', () => {
    renderPanel()
    fireEvent.click(screen.getByRole('radio', { name: /^dub$/i }))
    const url: string = mockPush.mock.calls[0][0]
    expect(url).toContain('audio=dub')
  })

  it('clicking Any calls router.push with audio=any', () => {
    renderPanel({ audio: 'sub' }) // start with sub active
    fireEvent.click(screen.getByRole('radio', { name: /^any$/i }))
    const url: string = mockPush.mock.calls[0][0]
    expect(url).toContain('audio=any')
  })

  it('reflects an existing audio param from the URL', () => {
    renderPanel({ audio: 'dub' })
    expect(screen.getByRole('radio', { name: /^dub$/i })).toBeChecked()
    expect(screen.getByRole('radio', { name: /^sub$/i })).not.toBeChecked()
  })
})

// ---------------------------------------------------------------------------
// Status interaction
// ---------------------------------------------------------------------------

describe('FilterPanel — status interaction', () => {
  it('clicking Airing calls router.push with status=airing', () => {
    renderPanel()
    fireEvent.click(screen.getByRole('radio', { name: /^airing$/i }))
    expect(mockPush).toHaveBeenCalledTimes(1)
    const url: string = mockPush.mock.calls[0][0]
    expect(url).toContain('status=airing')
  })

  it('clicking Finished calls router.push with status=finished', () => {
    renderPanel()
    fireEvent.click(screen.getByRole('radio', { name: /^finished$/i }))
    const url: string = mockPush.mock.calls[0][0]
    expect(url).toContain('status=finished')
  })

  it('clicking All removes the status param from the URL', () => {
    renderPanel({ status: 'airing' })
    fireEvent.click(screen.getByRole('radio', { name: /^all$/i }))
    const url: string = mockPush.mock.calls[0][0]
    expect(url).not.toContain('status=')
  })

  it('reflects an existing status param from the URL', () => {
    renderPanel({ status: 'finished' })
    expect(screen.getByRole('radio', { name: /^finished$/i })).toBeChecked()
  })
})

// ---------------------------------------------------------------------------
// Year interaction
// ---------------------------------------------------------------------------

describe('FilterPanel — year interaction', () => {
  it('changing year select calls router.push with year=<selected>', () => {
    renderPanel()
    const select = screen.getByTestId('filter-year')
    fireEvent.change(select, { target: { value: '2025' } })
    expect(mockPush).toHaveBeenCalledTimes(1)
    const url: string = mockPush.mock.calls[0][0]
    expect(url).toContain('year=2025')
  })

  it('selecting "All years" removes year from the URL', () => {
    renderPanel({ year: '2025' })
    const select = screen.getByTestId('filter-year')
    fireEvent.change(select, { target: { value: '' } })
    const url: string = mockPush.mock.calls[0][0]
    expect(url).not.toContain('year=')
  })

  it('reflects an existing year param from the URL', () => {
    renderPanel({ year: '2026' })
    const select = screen.getByTestId('filter-year') as HTMLSelectElement
    expect(select.value).toBe('2026')
  })
})

// ---------------------------------------------------------------------------
// Genre interaction
// ---------------------------------------------------------------------------

describe('FilterPanel — genre interaction', () => {
  it('clicking an unchecked genre checkbox adds it to genres param', () => {
    renderPanel()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Action' }))
    expect(mockPush).toHaveBeenCalledTimes(1)
    const url: string = mockPush.mock.calls[0][0]
    expect(url).toContain('genres=action')
  })

  it('clicking an active genre removes it from genres param', () => {
    // Simulate action already active in URL
    renderPanel({ genres: 'action' })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Action' }))
    const url: string = mockPush.mock.calls[0][0]
    // Should not contain action in genres anymore
    // URL might be just /search or have other params but not genres=action
    expect(url).not.toContain('genres=action')
  })

  it('reflects an existing genres param from the URL (checkbox is checked)', () => {
    renderPanel({ genres: 'action' })
    const actionCheckbox = screen.getByRole('checkbox', { name: 'Action' })
    expect(actionCheckbox).toBeChecked()
    const dramaCheckbox = screen.getByRole('checkbox', { name: 'Drama' })
    expect(dramaCheckbox).not.toBeChecked()
  })
})

// ---------------------------------------------------------------------------
// Clear filters
// ---------------------------------------------------------------------------

describe('FilterPanel — clear filters', () => {
  it('shows Clear button when a non-query filter is active', () => {
    renderPanel({ audio: 'sub' })
    expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument()
  })

  it('shows Clear button when a genre is selected', () => {
    renderPanel({ genres: 'action' })
    expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument()
  })

  it('shows Clear button when sort is non-default', () => {
    renderPanel({ sort: 'title' })
    expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument()
  })

  it('clicking Clear calls router.push and drops filter params but preserves q', () => {
    renderPanel({ q: 'frieren', audio: 'sub', sort: 'title' })
    fireEvent.click(screen.getByRole('button', { name: /clear/i }))
    expect(mockPush).toHaveBeenCalledTimes(1)
    const url: string = mockPush.mock.calls[0][0]
    // Query param preserved
    expect(url).toContain('q=frieren')
    // Filter params cleared
    expect(url).not.toContain('audio=')
    expect(url).not.toContain('sort=')
  })

  it('clicking Clear with no q param navigates to bare /search', () => {
    renderPanel({ audio: 'dub' })
    fireEvent.click(screen.getByRole('button', { name: /clear/i }))
    const url: string = mockPush.mock.calls[0][0]
    expect(url).toBe('/search')
  })
})

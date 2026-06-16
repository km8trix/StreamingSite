// HeaderSearch.test.tsx — Roadmap: SEARCH TYPEAHEAD combobox component tests.
//
// HeaderSearch is a 'use client' WAI-ARIA combobox. On each keystroke (>=2
// trimmed chars, 200ms-debounced) it fetches GET /api/search/suggestions?q=…
// and renders a listbox of matching shows. We mock global.fetch and
// next/navigation's useRouter, and drive the 200ms debounce with fake timers.
//
// fireEvent (synchronous) is used rather than userEvent here: userEvent's
// internal timer awaits deadlock against vi.useFakeTimers(), and this component's
// whole behaviour is timer-driven (debounce), so direct events + manual timer
// advance are the reliable way to test it.
//
// Covers (the QA deliverable):
//   - typing >=2 chars renders suggestions; <2 chars shows none (no fetch);
//   - ArrowDown + Enter navigates to /shows/<slug> (router.push);
//   - Enter with no active option pushes /shows?q=<value>;
//   - Escape closes the dropdown;
//   - STALE-RESPONSE: two overlapping fetches resolving out of order -> only the
//     latest query's suggestions render.

import { act, fireEvent, render, screen, within } from '@testing-library/react'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import type { SearchSuggestion } from '@/lib/data'

// ---------------------------------------------------------------------------
// Mock next/navigation BEFORE importing the component.
// ---------------------------------------------------------------------------
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

import { HeaderSearch } from './HeaderSearch'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function suggestion(overrides: Partial<SearchSuggestion> = {}): SearchSuggestion {
  return {
    slug: 'frieren-beyond-journeys-end',
    title: "Frieren: Beyond Journey's End",
    coverImage: 'https://cdn.example.com/frieren.jpg',
    year: 2023,
    ...overrides,
  }
}

// A Response-like object for the mocked fetch.
function jsonResponse(suggestions: SearchSuggestion[], ok = true) {
  return {
    ok,
    json: async () => ({ suggestions }),
  } as unknown as Response
}

// Set the input value (fires onChange) — synchronous, no timer awaits.
function typeQuery(input: HTMLElement, value: string) {
  fireEvent.change(input, { target: { value } })
}

// Advance past the 200ms debounce timer and flush the fetch + json microtasks
// so the suggestions state has settled.
async function flushDebouncedFetch() {
  await act(async () => {
    vi.advanceTimersByTime(250)
  })
  await act(async () => {
    // Two microtask turns: one for fetch(), one for res.json().
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
}

// type + settle in one step.
async function search(input: HTMLElement, value: string) {
  typeQuery(input, value)
  await flushDebouncedFetch()
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.useFakeTimers()
  mockPush.mockReset()
  fetchMock = vi.fn(async () => jsonResponse([suggestion()]))
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.runOnlyPendingTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// ===========================================================================
// Typing >= 2 chars renders suggestions
// ===========================================================================

describe('HeaderSearch — suggestions render', () => {
  it('fetches and renders a suggestion list when typing >= 2 chars', async () => {
    render(<HeaderSearch />)
    const input = screen.getByTestId('search-input')

    await search(input, 'fr')

    // It hit the suggestions endpoint with the typed query.
    expect(fetchMock).toHaveBeenCalled()
    const calledUrl = fetchMock.mock.calls.at(-1)![0] as string
    expect(calledUrl).toContain('/api/search/suggestions?q=fr')

    // The listbox + its option render.
    const listbox = screen.getByTestId('search-suggestions')
    expect(listbox).toBeInTheDocument()
    const options = within(listbox).getAllByTestId('search-suggestion')
    expect(options).toHaveLength(1)
    expect(options[0]).toHaveAttribute('data-slug', 'frieren-beyond-journeys-end')
    expect(options[0]).toHaveTextContent("Frieren: Beyond Journey's End")

    // ARIA combobox is expanded.
    expect(input).toHaveAttribute('aria-expanded', 'true')
  })

  it('renders multiple suggestions when several match', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse([
        suggestion({ slug: 'frieren-beyond-journeys-end', title: 'Frieren' }),
        suggestion({ slug: 'fruits-basket', title: 'Fruits Basket' }),
      ]),
    )
    render(<HeaderSearch />)
    await search(screen.getByTestId('search-input'), 'fr')

    const options = screen.getAllByTestId('search-suggestion')
    expect(options).toHaveLength(2)
  })

  it('shows the empty state when a >=2-char query returns no matches', async () => {
    fetchMock.mockResolvedValue(jsonResponse([]))
    render(<HeaderSearch />)
    await search(screen.getByTestId('search-input'), 'zz')

    expect(screen.getByTestId('search-suggestions-empty')).toBeInTheDocument()
    expect(screen.queryByTestId('search-suggestions')).not.toBeInTheDocument()
  })
})

// ===========================================================================
// < 2 chars shows none (and makes no request)
// ===========================================================================

describe('HeaderSearch — below the minimum length', () => {
  it('does not fetch and shows no dropdown for a single character', async () => {
    render(<HeaderSearch />)
    const input = screen.getByTestId('search-input')

    typeQuery(input, 'f')
    await act(async () => {
      vi.advanceTimersByTime(300)
    })

    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.queryByTestId('search-suggestions')).not.toBeInTheDocument()
    expect(screen.queryByTestId('search-suggestions-empty')).not.toBeInTheDocument()
    expect(input).toHaveAttribute('aria-expanded', 'false')
  })

  it('hides the dropdown again when the query drops below 2 chars', async () => {
    render(<HeaderSearch />)
    const input = screen.getByTestId('search-input')

    await search(input, 'fr')
    expect(screen.getByTestId('search-suggestions')).toBeInTheDocument()

    // Back to 1 char -> dropdown hidden, no list.
    typeQuery(input, 'f')
    await act(async () => {
      vi.advanceTimersByTime(300)
    })
    expect(screen.queryByTestId('search-suggestions')).not.toBeInTheDocument()
    expect(input).toHaveAttribute('aria-expanded', 'false')
  })
})

// ===========================================================================
// Keyboard: ArrowDown + Enter navigates to /shows/<slug>
// ===========================================================================

describe('HeaderSearch — keyboard navigation', () => {
  it('ArrowDown activates the first option and Enter navigates to /shows/<slug>', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse([
        suggestion({ slug: 'frieren-beyond-journeys-end', title: 'Frieren' }),
        suggestion({ slug: 'fruits-basket', title: 'Fruits Basket' }),
      ]),
    )
    render(<HeaderSearch />)
    const input = screen.getByTestId('search-input')

    await search(input, 'fr')
    screen.getByTestId('search-suggestions')

    // ArrowDown -> first option becomes active (aria-selected + activedescendant).
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    const options = screen.getAllByTestId('search-suggestion')
    expect(options[0]).toHaveAttribute('aria-selected', 'true')
    expect(input.getAttribute('aria-activedescendant')).toBe(options[0].id)

    // Enter on the active option -> navigate to that show. Enter on the input
    // submits the form, so dispatch a form submit (the component's onKeyDown
    // intentionally lets the native form submit fire).
    fireEvent.submit(input.closest('form')!)
    expect(mockPush).toHaveBeenCalledWith('/shows/frieren-beyond-journeys-end')
  })

  it('ArrowDown twice activates the second option; Enter goes to its slug', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse([
        suggestion({ slug: 'frieren-beyond-journeys-end', title: 'Frieren' }),
        suggestion({ slug: 'fruits-basket', title: 'Fruits Basket' }),
      ]),
    )
    render(<HeaderSearch />)
    const input = screen.getByTestId('search-input')

    await search(input, 'fr')
    screen.getByTestId('search-suggestions')

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    const options = screen.getAllByTestId('search-suggestion')
    expect(options[1]).toHaveAttribute('aria-selected', 'true')

    fireEvent.submit(input.closest('form')!)
    expect(mockPush).toHaveBeenCalledWith('/shows/fruits-basket')
  })

  it('ArrowUp from no selection wraps to the last option', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse([
        suggestion({ slug: 'a-show', title: 'A Show' }),
        suggestion({ slug: 'z-show', title: 'Z Show' }),
      ]),
    )
    render(<HeaderSearch />)
    const input = screen.getByTestId('search-input')

    await search(input, 'sh')
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    const options = screen.getAllByTestId('search-suggestion')
    expect(options[options.length - 1]).toHaveAttribute('aria-selected', 'true')
  })

  it('clicking a suggestion navigates to /shows/<slug>', async () => {
    render(<HeaderSearch />)
    await search(screen.getByTestId('search-input'), 'fr')

    const option = screen.getByTestId('search-suggestion')
    // The option uses onMouseDown (fires before input blur closes the list).
    fireEvent.mouseDown(option)
    expect(mockPush).toHaveBeenCalledWith('/shows/frieren-beyond-journeys-end')
  })
})

// ===========================================================================
// Enter with no active option -> /shows?q=<value>
// ===========================================================================

describe('HeaderSearch — full-text submit', () => {
  it('Enter with no active option pushes /shows?q=<value>', async () => {
    render(<HeaderSearch />)
    const input = screen.getByTestId('search-input')

    await search(input, 'frieren')
    screen.getByTestId('search-suggestions')

    // No ArrowDown -> no active option -> submit runs the full search.
    fireEvent.submit(input.closest('form')!)
    expect(mockPush).toHaveBeenCalledWith('/shows?q=frieren')
    // It did NOT navigate to a show detail page.
    expect(mockPush).not.toHaveBeenCalledWith(
      expect.stringMatching(/^\/shows\//),
    )
  })

  it('submitting an empty input navigates to bare /shows', async () => {
    render(<HeaderSearch />)
    const input = screen.getByTestId('search-input')
    fireEvent.submit(input.closest('form')!)
    expect(mockPush).toHaveBeenCalledWith('/shows')
  })

  it('URL-encodes the query in the full-text submit', async () => {
    render(<HeaderSearch />)
    const input = screen.getByTestId('search-input')
    await search(input, 'a b')
    fireEvent.submit(input.closest('form')!)
    expect(mockPush).toHaveBeenCalledWith('/shows?q=a%20b')
  })
})

// ===========================================================================
// Escape closes the dropdown
// ===========================================================================

describe('HeaderSearch — Escape', () => {
  it('Escape closes the dropdown (collapses the combobox)', async () => {
    render(<HeaderSearch />)
    const input = screen.getByTestId('search-input')

    await search(input, 'fr')
    expect(screen.getByTestId('search-suggestions')).toBeInTheDocument()
    expect(input).toHaveAttribute('aria-expanded', 'true')

    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByTestId('search-suggestions')).not.toBeInTheDocument()
    expect(input).toHaveAttribute('aria-expanded', 'false')
    // Escape closes the list but does not navigate.
    expect(mockPush).not.toHaveBeenCalled()
  })
})

// ===========================================================================
// STALE-RESPONSE: out-of-order resolution -> only the latest query renders
// ===========================================================================

describe('HeaderSearch — stale-response handling', () => {
  it('ignores a slow earlier response that resolves after a newer one', async () => {
    // Two overlapping fetches: the FIRST (q=fr) resolves LATE with stale data;
    // the SECOND (q=frie) resolves FIRST with the fresh data. Only the fresh
    // suggestions for the latest query may render.
    let resolveFirst!: (r: Response) => void
    const firstPending = new Promise<Response>((res) => {
      resolveFirst = res
    })
    const staleResp = jsonResponse([
      suggestion({ slug: 'stale-show', title: 'STALE Result' }),
    ])
    const freshResp = jsonResponse([
      suggestion({ slug: 'fresh-show', title: 'FRESH Result' }),
    ])

    fetchMock
      .mockImplementationOnce(() => firstPending) // q=fr — resolves later
      .mockImplementationOnce(async () => freshResp) // q=frie — resolves now

    render(<HeaderSearch />)
    const input = screen.getByTestId('search-input')

    // First query -> fires fetch #1 (still pending).
    typeQuery(input, 'fr')
    await act(async () => {
      vi.advanceTimersByTime(250)
    })

    // Second query -> fires fetch #2 (resolves immediately with fresh data).
    typeQuery(input, 'frie')
    await flushDebouncedFetch()

    // The fresh (latest-query) result is shown.
    const listbox = screen.getByTestId('search-suggestions')
    expect(within(listbox).getByText('FRESH Result')).toBeInTheDocument()

    // Now the STALE earlier request finally resolves — it must be DROPPED
    // (the latestQueryRef guard + AbortController in the component).
    await act(async () => {
      resolveFirst(staleResp)
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(screen.queryByText('STALE Result')).not.toBeInTheDocument()
    const after = screen.getByTestId('search-suggestions')
    expect(within(after).getByText('FRESH Result')).toBeInTheDocument()
    expect(within(after).getAllByTestId('search-suggestion')).toHaveLength(1)
  })
})

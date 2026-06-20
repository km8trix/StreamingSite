import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the server actions (they'd otherwise hit Supabase) and the router.
const { addToWatchlist, removeFromWatchlist, refresh } = vi.hoisted(() => ({
  addToWatchlist: vi.fn(async () => ({ ok: true })),
  removeFromWatchlist: vi.fn(async () => ({ ok: true })),
  refresh: vi.fn(),
}))
vi.mock('@/lib/watch/actions', () => ({ addToWatchlist, removeFromWatchlist }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

import { WatchlistButton } from './WatchlistButton'

const show = {
  id: 'show-1',
  slug: 'frieren',
  title: 'Frieren',
  coverImage: 'https://img.example/x.jpg',
  year: 2023,
}

beforeEach(() => {
  window.localStorage.clear()
  addToWatchlist.mockClear()
  removeFromWatchlist.mockClear()
  refresh.mockClear()
})
afterEach(cleanup)

describe('WatchlistButton — guest', () => {
  it('saves to localStorage and flips to "In My List" (no server call)', () => {
    render(<WatchlistButton show={show} isSignedIn={false} />)
    const btn = screen.getByTestId('watchlist-button')
    expect(btn).toHaveAttribute('data-saved', 'false')
    expect(btn).toHaveTextContent('Add to My List')

    fireEvent.click(btn)
    expect(btn).toHaveAttribute('data-saved', 'true')
    expect(btn).toHaveAttribute('aria-pressed', 'true')
    expect(btn).toHaveTextContent('In My List')
    expect(window.localStorage.getItem('senpai:watchlist:v1')).toContain('show-1')
    expect(addToWatchlist).not.toHaveBeenCalled()
  })

  it('toggles back off (removes from the guest list)', () => {
    render(<WatchlistButton show={show} isSignedIn={false} />)
    const btn = screen.getByTestId('watchlist-button')
    fireEvent.click(btn) // save
    fireEvent.click(btn) // remove
    expect(btn).toHaveAttribute('data-saved', 'false')
  })
})

describe('WatchlistButton — signed in', () => {
  it('optimistically saves and calls addToWatchlist', async () => {
    render(<WatchlistButton show={show} isSignedIn initialSaved={false} />)
    const btn = screen.getByTestId('watchlist-button')
    fireEvent.click(btn)
    expect(btn).toHaveAttribute('data-saved', 'true') // optimistic
    await waitFor(() => expect(addToWatchlist).toHaveBeenCalledWith('show-1'))
  })

  it('seeds from initialSaved and removes via removeFromWatchlist', async () => {
    render(<WatchlistButton show={show} isSignedIn initialSaved />)
    const btn = screen.getByTestId('watchlist-button')
    expect(btn).toHaveAttribute('data-saved', 'true')
    fireEvent.click(btn)
    expect(btn).toHaveAttribute('data-saved', 'false') // optimistic
    await waitFor(() => expect(removeFromWatchlist).toHaveBeenCalledWith('show-1'))
  })
})

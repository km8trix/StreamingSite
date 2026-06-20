import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WatchlistItem } from '@/lib/data'

const { removeFromWatchlist, refresh } = vi.hoisted(() => ({
  removeFromWatchlist: vi.fn(async () => ({ ok: true })),
  refresh: vi.fn(),
}))
vi.mock('@/lib/watch/actions', () => ({ removeFromWatchlist }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

import { MyListRail } from './MyListRail'

function item(id: string): WatchlistItem {
  return {
    showId: id,
    slug: `s-${id}`,
    title: `Title ${id}`,
    coverImage: 'https://img.example/x.jpg',
    year: 2023,
    addedAt: '2026-01-01T00:00:00.000Z',
  }
}

beforeEach(() => {
  window.localStorage.clear()
  removeFromWatchlist.mockClear()
  refresh.mockClear()
})
afterEach(cleanup)

describe('MyListRail — signed in', () => {
  it('renders a card per item from the server prop', () => {
    render(<MyListRail items={[item('a'), item('b')]} isSignedIn />)
    expect(screen.getByTestId('my-list-rail')).toBeInTheDocument()
    expect(screen.getAllByTestId('watchlist-card')).toHaveLength(2)
  })

  it('optimistically removes a card and calls removeFromWatchlist', async () => {
    render(<MyListRail items={[item('a'), item('b')]} isSignedIn />)
    fireEvent.click(screen.getAllByTestId('watchlist-remove')[0])
    expect(screen.getAllByTestId('watchlist-card')).toHaveLength(1) // optimistic
    await waitFor(() => expect(removeFromWatchlist).toHaveBeenCalledWith('a'))
  })

  it('reverts the optimistic removal when the server delete fails', async () => {
    removeFromWatchlist.mockResolvedValueOnce({ ok: false })
    render(<MyListRail items={[item('a'), item('b')]} isSignedIn />)
    fireEvent.click(screen.getAllByTestId('watchlist-remove')[0])
    // Optimistically hidden first...
    expect(screen.getAllByTestId('watchlist-card')).toHaveLength(1)
    // ...then restored once the failed action resolves.
    await waitFor(() =>
      expect(screen.getAllByTestId('watchlist-card')).toHaveLength(2),
    )
  })

  it('renders nothing when the list is empty', () => {
    const { container } = render(<MyListRail items={[]} isSignedIn />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('MyListRail — guest', () => {
  it('reads the saved list from localStorage and never calls the server', () => {
    window.localStorage.setItem(
      'senpai:watchlist:v1',
      JSON.stringify({ a: item('a') }),
    )
    render(<MyListRail items={[]} isSignedIn={false} />)
    expect(screen.getByTestId('my-list-rail')).toBeInTheDocument()
    expect(screen.getByTestId('watchlist-card')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('watchlist-remove'))
    expect(screen.queryByTestId('watchlist-card')).not.toBeInTheDocument()
    expect(removeFromWatchlist).not.toHaveBeenCalled()
  })
})

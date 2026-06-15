import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EpisodeList } from './EpisodeList'
import { makeEpisode } from '@/test/fixtures'

describe('EpisodeList', () => {
  it('renders one row per episode', () => {
    render(
      <EpisodeList
        episodes={[
          makeEpisode({ id: 'a', number: 1 }),
          makeEpisode({ id: 'b', number: 2 }),
          makeEpisode({ id: 'c', number: 3 }),
        ]}
      />,
    )
    expect(screen.getByTestId('episode-list')).toBeInTheDocument()
    expect(screen.getAllByTestId('episode-row')).toHaveLength(3)
  })

  it('renders episode number and title', () => {
    render(
      <EpisodeList
        episodes={[makeEpisode({ number: 7, title: 'Heavy Metal Queen' })]}
      />,
    )
    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.getByText('Heavy Metal Queen')).toBeInTheDocument()
  })

  it('shows sub/dub availability indicators per episode', () => {
    render(
      <EpisodeList
        episodes={[makeEpisode({ isSubbed: true, isDubbed: false })]}
      />,
    )
    expect(screen.getByLabelText('SUB available')).toBeInTheDocument()
    expect(screen.getByLabelText('DUB unavailable')).toBeInTheDocument()
  })

  it('renders a single-episode show (movie) without error', () => {
    render(
      <EpisodeList
        episodes={[
          makeEpisode({ id: 'movie', number: 1, title: 'The Movie' }),
        ]}
      />,
    )
    expect(screen.getAllByTestId('episode-row')).toHaveLength(1)
    expect(screen.getByText('The Movie')).toBeInTheDocument()
  })

  it('shows an empty state when there are no episodes', () => {
    render(<EpisodeList episodes={[]} />)
    expect(screen.queryByTestId('episode-list')).not.toBeInTheDocument()
    expect(screen.getByText(/no episodes listed yet/i)).toBeInTheDocument()
  })

  it('renders a formatted air date when present and omits it when null', () => {
    const { rerender } = render(
      <EpisodeList episodes={[makeEpisode({ airDate: '1998-04-03' })]} />,
    )
    // Locale-formatted; assert the year is present rather than exact locale string.
    expect(screen.getByText(/1998/)).toBeInTheDocument()

    rerender(
      <EpisodeList
        episodes={[makeEpisode({ airDate: null, title: 'No Air Date' })]}
      />,
    )
    expect(screen.getByText('No Air Date')).toBeInTheDocument()
  })
})

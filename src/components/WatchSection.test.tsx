// WatchSection.test.tsx — unit tests for the watch-experience branching.
//
// WatchSection owns the "active episode" state and decides which of the two
// render paths to show:
//   - active episode HAS a `videoUrl` → render the real <VideoPlayer> (wired to
//     that manifest URL);
//   - active episode has NO source (null/empty videoUrl) → render the
//     <PlayerPlaceholder> ("Streaming coming soon"), NOT a broken player.
//
// We stub the child <VideoPlayer> so these tests assert WatchSection's logic
// (selection + which path renders + what src it forwards) without booting hls.js
// or a real <video> element. The PlayerPlaceholder renders for real (it is a
// pure server-safe presentational component).

import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeEpisode } from '@/test/fixtures'

// Stub VideoPlayer: render a marker that echoes the src it received so tests can
// assert WatchSection forwarded the correct manifest URL.
vi.mock('./VideoPlayer', () => ({
  VideoPlayer: ({ src, title }: { src: string; title?: string }) => (
    <div data-testid="video-player" data-src={src} data-title={title}>
      mock-video-player
    </div>
  ),
}))

import { WatchSection } from './WatchSection'

const MANIFEST = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'

afterEach(cleanup)

describe('WatchSection — default render path', () => {
  it('renders the VideoPlayer wired to the manifest when episode 1 has a source', () => {
    const episodes = [
      makeEpisode({ id: 'ep-1', number: 1, videoUrl: MANIFEST }),
      makeEpisode({ id: 'ep-2', number: 2, videoUrl: null }),
    ]
    render(<WatchSection title="Frieren" episodes={episodes} />)

    expect(screen.getByTestId('watch-section')).toBeInTheDocument()
    const player = screen.getByTestId('video-player')
    expect(player).toBeInTheDocument()
    expect(player).toHaveAttribute('data-src', MANIFEST)
    // No placeholder when a real stream is active.
    expect(screen.queryByTestId('player-placeholder')).not.toBeInTheDocument()
  })

  it('defaults to the FIRST episode that has a stream, even if it is not episode 1', () => {
    const episodes = [
      makeEpisode({ id: 'ep-1', number: 1, videoUrl: null }),
      makeEpisode({ id: 'ep-2', number: 2, videoUrl: MANIFEST }),
    ]
    render(<WatchSection title="Frieren" episodes={episodes} />)

    expect(screen.getByTestId('video-player')).toHaveAttribute(
      'data-src',
      MANIFEST,
    )
  })

  it('renders the PlayerPlaceholder (not a broken player) when NO episode has a source', () => {
    const episodes = [
      makeEpisode({ id: 'ep-1', number: 1, videoUrl: null }),
      makeEpisode({ id: 'ep-2', number: 2, videoUrl: null }),
    ]
    render(<WatchSection title="Frieren" episodes={episodes} />)

    expect(screen.getByTestId('player-placeholder')).toBeInTheDocument()
    expect(screen.queryByTestId('video-player')).not.toBeInTheDocument()
  })

  it('renders the placeholder when the active episode has an empty-string source', () => {
    // The component treats falsy videoUrl (null OR '') as "no stream".
    const episodes = [
      makeEpisode({ id: 'ep-1', number: 1, videoUrl: '' }),
    ]
    render(<WatchSection title="Frieren" episodes={episodes} />)

    expect(screen.getByTestId('player-placeholder')).toBeInTheDocument()
    expect(screen.queryByTestId('video-player')).not.toBeInTheDocument()
  })
})

describe('WatchSection — episode selection', () => {
  const episodes = [
    makeEpisode({ id: 'ep-1', number: 1, title: 'Premiere', videoUrl: MANIFEST }),
    makeEpisode({ id: 'ep-2', number: 2, title: 'Two', videoUrl: null }),
    makeEpisode({ id: 'ep-3', number: 3, title: 'Three', videoUrl: null }),
  ]

  it('renders a selector with one option per episode (multi-episode show)', () => {
    render(<WatchSection title="Frieren" episodes={episodes} />)
    expect(screen.getByTestId('episode-select')).toBeInTheDocument()
    expect(screen.getAllByTestId('episode-select-option')).toHaveLength(3)
  })

  it('swaps to the placeholder when a higher episode without a source is selected', () => {
    render(<WatchSection title="Frieren" episodes={episodes} />)

    // Starts on ep 1 (has stream) → real player.
    expect(screen.getByTestId('video-player')).toHaveAttribute(
      'data-src',
      MANIFEST,
    )

    // Pick episode 2 (no source).
    const ep2 = screen
      .getAllByTestId('episode-select-option')
      .find((b) => b.getAttribute('data-episode-id') === 'ep-2')!
    fireEvent.click(ep2)

    expect(screen.getByTestId('player-placeholder')).toBeInTheDocument()
    expect(screen.queryByTestId('video-player')).not.toBeInTheDocument()
  })

  it('marks watchable episodes with data-has-video and the active one with aria-pressed', () => {
    render(<WatchSection title="Frieren" episodes={episodes} />)
    const options = screen.getAllByTestId('episode-select-option')

    const ep1 = options.find((b) => b.getAttribute('data-episode-id') === 'ep-1')!
    const ep2 = options.find((b) => b.getAttribute('data-episode-id') === 'ep-2')!

    expect(ep1).toHaveAttribute('data-has-video', 'true')
    expect(ep2).toHaveAttribute('data-has-video', 'false')
    // ep1 is the default active episode.
    expect(ep1).toHaveAttribute('aria-pressed', 'true')
    expect(ep2).toHaveAttribute('aria-pressed', 'false')
  })

  it('does NOT render the selector for a single-episode entry (movie)', () => {
    const single = [makeEpisode({ id: 'ep-1', number: 1, videoUrl: MANIFEST })]
    render(<WatchSection title="A Silent Voice" episodes={single} />)

    expect(screen.queryByTestId('episode-select')).not.toBeInTheDocument()
    // Still plays the stream.
    expect(screen.getByTestId('video-player')).toHaveAttribute(
      'data-src',
      MANIFEST,
    )
  })
})

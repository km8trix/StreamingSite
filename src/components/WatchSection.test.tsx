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

// Required props unrelated to the branching logic under test. isSignedIn:false
// keeps the (un-fired) progress recorder on the guest path; the mocked
// VideoPlayer never calls onProgress, so no recording actually runs.
const base = {
  showId: 'show-1',
  slug: 'frieren',
  coverImage: 'https://img.example/cover.jpg',
  isSignedIn: false,
}

afterEach(cleanup)

describe('WatchSection — default render path', () => {
  it('renders the VideoPlayer wired to the manifest when episode 1 has a source', () => {
    const episodes = [
      makeEpisode({ id: 'ep-1', number: 1, videoUrl: MANIFEST }),
      makeEpisode({ id: 'ep-2', number: 2, videoUrl: null }),
    ]
    render(<WatchSection {...base} title="Frieren" episodes={episodes} />)

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
    render(<WatchSection {...base} title="Frieren" episodes={episodes} />)

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
    render(<WatchSection {...base} title="Frieren" episodes={episodes} />)

    expect(screen.getByTestId('player-placeholder')).toBeInTheDocument()
    expect(screen.queryByTestId('video-player')).not.toBeInTheDocument()
  })

  it('renders the placeholder when the active episode has an empty-string source', () => {
    // The component treats falsy videoUrl (null OR '') as "no stream".
    const episodes = [
      makeEpisode({ id: 'ep-1', number: 1, videoUrl: '' }),
    ]
    render(<WatchSection {...base} title="Frieren" episodes={episodes} />)

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
    render(<WatchSection {...base} title="Frieren" episodes={episodes} />)
    expect(screen.getByTestId('episode-select')).toBeInTheDocument()
    expect(screen.getAllByTestId('episode-select-option')).toHaveLength(3)
  })

  it('swaps to the placeholder when a higher episode without a source is selected', () => {
    render(<WatchSection {...base} title="Frieren" episodes={episodes} />)

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
    render(<WatchSection {...base} title="Frieren" episodes={episodes} />)
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
    render(<WatchSection {...base} title="A Silent Voice" episodes={single} />)

    expect(screen.queryByTestId('episode-select')).not.toBeInTheDocument()
    // Still plays the stream.
    expect(screen.getByTestId('video-player')).toHaveAttribute(
      'data-src',
      MANIFEST,
    )
  })
})

describe('WatchSection — deep-linked initial episode', () => {
  const episodes = [
    makeEpisode({ id: 'ep-1', number: 1, videoUrl: MANIFEST }),
    makeEpisode({ id: 'ep-2', number: 2, videoUrl: null }),
  ]

  it('honors a plain deep-link to a not-yet-streamable episode (no resume)', () => {
    // e.g. the Release Schedule episode badge → ?ep=<id>, no &t=. We should
    // land on ep-2 (its placeholder), NOT silently fall back to playable ep-1.
    render(
      <WatchSection
        {...base}
        title="Frieren"
        episodes={episodes}
        initialEpisodeId="ep-2"
      />,
    )
    const active = screen
      .getAllByTestId('episode-select-option')
      .find((b) => b.getAttribute('aria-pressed') === 'true')!
    expect(active).toHaveAttribute('data-episode-id', 'ep-2')
    expect(screen.getByTestId('player-placeholder')).toBeInTheDocument()
  })

  it('a RESUME (initialStartSeconds>0) onto a sourceless episode still falls back to a playable one', () => {
    // Continue Watching deep-link: ?ep=ep-2&t=120. A resume must never land on
    // the "coming soon" placeholder, so it falls back to the first playable.
    render(
      <WatchSection
        {...base}
        title="Frieren"
        episodes={episodes}
        initialEpisodeId="ep-2"
        initialStartSeconds={120}
      />,
    )
    expect(screen.getByTestId('video-player')).toHaveAttribute(
      'data-src',
      MANIFEST,
    )
    expect(screen.queryByTestId('player-placeholder')).not.toBeInTheDocument()
  })
})

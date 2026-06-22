// WatchSection.test.tsx — the discovery watch hub.
//
// The owned HLS player is retired: WatchSection no longer plays video. It now
// leads with the LEGAL watch path —
//   - an OfficialEmbed (YouTube IFrame) when a provider link is officially
//     embeddable AND resolves to a concrete /embed/ URL;
//   - the WhereToWatch panel of out-links to licensed providers (always).
// Both children render for real (pure, server-safe), so these tests assert the
// branching from the `links` prop end-to-end.

import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { StreamingLink } from '@/lib/data'
import { WatchSection } from './WatchSection'

const crunchyroll: StreamingLink = {
  site: 'Crunchyroll',
  url: 'https://www.crunchyroll.com/series/abc',
  embeddable: false,
}
// An official YouTube video link (Muse Asia / Ani-One style) — embeddable.
const youtubeVideo: StreamingLink = {
  site: 'YouTube',
  url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  embeddable: true,
}
// A YouTube CHANNEL link — flagged embeddable by host, but not iframe-able.
const youtubeChannel: StreamingLink = {
  site: 'YouTube',
  url: 'https://www.youtube.com/@MuseAsia',
  embeddable: true,
}

afterEach(cleanup)

describe('WatchSection — official embed', () => {
  it('renders an OfficialEmbed wired to the YouTube /embed/ URL when a link is embeddable', () => {
    render(<WatchSection title="Frieren" links={[youtubeVideo, crunchyroll]} />)

    expect(screen.getByTestId('watch-section')).toBeInTheDocument()
    const embed = screen.getByTestId('official-embed')
    expect(embed).toBeInTheDocument()
    // Facade: the iframe is injected only after the visitor clicks play.
    fireEvent.click(screen.getByRole('button', { name: /watch frieren on youtube/i }))
    expect(embed.querySelector('iframe')).toHaveAttribute(
      'src',
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1',
    )
    // The provider out-links still render below the embed.
    expect(screen.getByTestId('where-to-watch')).toBeInTheDocument()
  })

  it('does NOT embed a YouTube channel/handle page (not iframe-able), but still lists it', () => {
    render(<WatchSection title="Frieren" links={[youtubeChannel]} />)

    expect(screen.queryByTestId('official-embed')).not.toBeInTheDocument()
    // The channel is still offered as an out-link in the WhereToWatch panel.
    expect(screen.getAllByTestId('where-to-watch-link')).toHaveLength(1)
  })

  it('picks the FIRST embeddable link when several are present', () => {
    const second: StreamingLink = {
      site: 'YouTube (dub)',
      url: 'https://youtu.be/abcdefghijk',
      embeddable: true,
    }
    render(
      <WatchSection
        title="Frieren"
        links={[crunchyroll, youtubeVideo, second]}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /watch frieren on youtube/i }))
    expect(
      screen.getByTestId('official-embed').querySelector('iframe'),
    ).toHaveAttribute(
      'src',
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1',
    )
  })
})

describe('WatchSection — no embed', () => {
  it('renders only the WhereToWatch out-link panel when no link is embeddable', () => {
    render(<WatchSection title="Frieren" links={[crunchyroll]} />)

    expect(screen.queryByTestId('official-embed')).not.toBeInTheDocument()
    expect(screen.getByTestId('where-to-watch')).toBeInTheDocument()
    expect(screen.getByTestId('where-to-watch-link')).toHaveAttribute(
      'href',
      crunchyroll.url,
    )
  })

  it('renders the WhereToWatch empty state when there are no providers at all', () => {
    render(<WatchSection title="Frieren" links={[]} />)

    expect(screen.queryByTestId('official-embed')).not.toBeInTheDocument()
    expect(screen.getByTestId('where-to-watch-empty')).toBeInTheDocument()
  })

  it('never renders an owned <video> player or a "coming soon" placeholder', () => {
    render(<WatchSection title="Frieren" links={[crunchyroll]} />)
    expect(screen.queryByTestId('video-player')).not.toBeInTheDocument()
    expect(screen.queryByTestId('player-placeholder')).not.toBeInTheDocument()
    expect(document.querySelector('video')).toBeNull()
  })
})

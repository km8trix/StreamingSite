import { ImageResponse } from 'next/og'

// Default Open Graph / social card for the whole site (home + any route that
// doesn't supply its own image, e.g. the show page sets its cover). Generated at
// the edge from JSX via next/og — no static asset to keep in sync with the brand.
// Twitter inherits og:image when no twitter-image is present.

export const alt = 'Senpai — Anime Streaming'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: '96px',
          // Brand: near-black base with a violet glow (matches globals.css).
          background:
            'radial-gradient(circle at 75% 25%, #2a1a4d 0%, #08080c 55%)',
          color: '#f4f4f8',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            fontSize: 132,
            fontWeight: 800,
            letterSpacing: '-0.04em',
            color: '#a78bfa',
          }}
        >
          Senpai
        </div>
        <div
          style={{
            marginTop: 16,
            fontSize: 48,
            fontWeight: 600,
            color: '#f4f4f8',
          }}
        >
          Anime Streaming
        </div>
        <div
          style={{
            marginTop: 28,
            fontSize: 30,
            color: '#a6a6b8',
            maxWidth: 820,
          }}
        >
          Browse a curated catalog with sub &amp; dub counts. Discover trending
          and recommended series.
        </div>
      </div>
    ),
    { ...size },
  )
}

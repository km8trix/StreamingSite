import { describe, expect, it } from 'vitest'
import { toYouTubeEmbedSrc } from './youtube'

const EMBED = 'https://www.youtube-nocookie.com/embed'

describe('toYouTubeEmbedSrc — embeddable forms', () => {
  it('maps a watch?v= URL to a nocookie /embed/ src', () => {
    expect(toYouTubeEmbedSrc('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(
      `${EMBED}/dQw4w9WgXcQ`,
    )
  })

  it('maps a youtu.be short link', () => {
    expect(toYouTubeEmbedSrc('https://youtu.be/dQw4w9WgXcQ')).toBe(
      `${EMBED}/dQw4w9WgXcQ`,
    )
  })

  it('accepts m.youtube.com and www-less hosts', () => {
    expect(toYouTubeEmbedSrc('https://m.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(
      `${EMBED}/dQw4w9WgXcQ`,
    )
    expect(toYouTubeEmbedSrc('https://youtube.com/watch?v=dQw4w9WgXcQ')).toBe(
      `${EMBED}/dQw4w9WgXcQ`,
    )
  })

  it('passes through an existing /embed/<id> path', () => {
    expect(toYouTubeEmbedSrc('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe(
      `${EMBED}/dQw4w9WgXcQ`,
    )
  })

  it('ignores extra query params (t) on a watch URL but keeps the video', () => {
    expect(
      toYouTubeEmbedSrc('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s'),
    ).toBe(`${EMBED}/dQw4w9WgXcQ`)
  })

  it('maps a playlist URL to an embed/videoseries src', () => {
    expect(
      toYouTubeEmbedSrc('https://www.youtube.com/playlist?list=PL1234567890ab'),
    ).toBe(`${EMBED}/videoseries?list=PL1234567890ab`)
  })
})

describe('toYouTubeEmbedSrc — non-embeddable forms return null', () => {
  it.each([
    ['a channel handle', 'https://www.youtube.com/@MuseAsia'],
    ['a /channel/ page', 'https://www.youtube.com/channel/UC1234567890'],
    ['a /user/ page', 'https://www.youtube.com/user/SomeUser'],
    ['a bare youtube.com home', 'https://www.youtube.com/'],
    ['a watch URL with no v param', 'https://www.youtube.com/watch?feature=x'],
    ['a malformed video id', 'https://www.youtube.com/watch?v=short'],
    ['a non-youtube host', 'https://www.crunchyroll.com/series/abc'],
    ['an http (non-https) URL', 'http://www.youtube.com/watch?v=dQw4w9WgXcQ'],
    ['a non-URL string', 'not a url'],
    ['an empty string', ''],
  ])('returns null for %s', (_label, url) => {
    expect(toYouTubeEmbedSrc(url)).toBeNull()
  })
})

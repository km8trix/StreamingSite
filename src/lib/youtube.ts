// youtube.ts — turn a YouTube URL into a safe IFrame embed src (or null).
//
// AniList lists some titles as officially streaming on YouTube (e.g. Muse Asia,
// Ani-One). getWhereToWatch() flags those StreamingLinks as `embeddable` purely
// by host. But not every youtube.com URL can be iframed — channel/@handle/user
// pages cannot. toYouTubeEmbedSrc() narrows an embeddable link to a concrete
// /embed/ src for a single video or a playlist, and returns null otherwise so
// the caller falls back to a plain "watch on" out-link. Pure + unit-tested.

// youtube-nocookie.com is YouTube's privacy-enhanced host (no cookies until the
// viewer plays). Same embed paths as youtube.com.
const EMBED_HOST = 'https://www.youtube-nocookie.com'

// A video id is exactly 11 url-safe base64 chars; a playlist id is a longer
// PL…/UU…/OL… token. Validate so we never build an /embed/ URL from garbage.
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/
const PLAYLIST_ID = /^[A-Za-z0-9_-]{12,}$/

function isVideoId(id: string | null | undefined): id is string {
  return typeof id === 'string' && VIDEO_ID.test(id)
}

/**
 * Convert a YouTube watch/share/playlist URL to a youtube-nocookie /embed/ src,
 * or null when the URL is not a directly-embeddable video or playlist (e.g. a
 * channel page, which YouTube refuses to iframe). Never throws.
 */
export function toYouTubeEmbedSrc(url: string): string | null {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return null
  }

  if (u.protocol !== 'https:') return null
  const host = u.hostname.replace(/^www\./, '').replace(/^m\./, '')
  if (host !== 'youtube.com' && host !== 'youtu.be') return null

  // youtu.be/<id>
  if (host === 'youtu.be') {
    const id = u.pathname.slice(1).split('/')[0]
    return isVideoId(id) ? `${EMBED_HOST}/embed/${id}` : null
  }

  // youtube.com/watch?v=<id>
  if (u.pathname === '/watch') {
    const id = u.searchParams.get('v')
    return isVideoId(id) ? `${EMBED_HOST}/embed/${id}` : null
  }

  // youtube.com/embed/<id> (already an embed path)
  if (u.pathname.startsWith('/embed/')) {
    const id = u.pathname.split('/')[2]
    return isVideoId(id) ? `${EMBED_HOST}/embed/${id}` : null
  }

  // youtube.com/playlist?list=<id> (a series — embed as videoseries)
  if (u.pathname === '/playlist') {
    const list = u.searchParams.get('list')
    return list && PLAYLIST_ID.test(list)
      ? `${EMBED_HOST}/embed/videoseries?list=${list}`
      : null
  }

  // Channel / @handle / user / results pages are not iframe-embeddable.
  return null
}

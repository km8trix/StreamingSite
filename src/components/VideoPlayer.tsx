'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'

/**
 * VideoPlayer — a real HLS player for the show detail page.
 *
 * Strategy (client-only; never SSR'd because of `'use client'` + the effect):
 *  - If the browser can play HLS natively (Safari/iOS:
 *    `video.canPlayType('application/vnd.apple.mpegurl')`), set `video.src`
 *    directly and let the platform handle the manifest.
 *  - Otherwise dynamically import hls.js (so it stays out of the SSR/server
 *    bundle), attach it to the <video>, and load the manifest.
 *
 * Non-invasive by design: native `controls`, NO autoplay with sound. We default
 * to click-to-play (no autoplay at all) so opening a show page never blasts
 * audio. The hls.js instance is created in an effect keyed on `src` and fully
 * destroyed (detached) on unmount / source-change so there are no leaks or
 * lingering network requests when the user switches episodes.
 */
export function VideoPlayer({
  src,
  poster,
  title,
}: {
  src: string
  poster?: string | null
  title?: string
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  )

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    // Reset state whenever the source changes (episode switch).
    setStatus('loading')

    let hls: import('hls.js').default | null = null
    let cancelled = false

    function markReady() {
      if (!cancelled) setStatus('ready')
    }

    // 1) Native HLS (Safari / iOS): assign the manifest URL directly.
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      function onError() {
        if (!cancelled) setStatus('error')
      }
      video.src = src
      video.addEventListener('loadedmetadata', markReady)
      video.addEventListener('error', onError)
      return () => {
        cancelled = true
        video.removeEventListener('loadedmetadata', markReady)
        video.removeEventListener('error', onError)
        video.removeAttribute('src')
        video.load()
      }
    }

    // 2) Everyone else: hls.js. Import lazily so it never enters the server
    //    bundle and only loads in the browser when actually needed.
    import('hls.js')
      .then(({ default: Hls }) => {
        if (cancelled) return

        if (!Hls.isSupported()) {
          // No MSE support and no native HLS — nothing we can do.
          setStatus('error')
          return
        }

        hls = new Hls({ enableWorker: true })
        hls.on(Hls.Events.MANIFEST_PARSED, markReady)
        hls.on(Hls.Events.ERROR, (_event, data) => {
          // Only surface fatal errors to the user; hls.js recovers from many
          // non-fatal media/network blips on its own.
          if (data.fatal && !cancelled) setStatus('error')
        })
        hls.loadSource(src)
        hls.attachMedia(video)
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })

    return () => {
      cancelled = true
      if (hls) {
        hls.destroy()
        hls = null
      }
    }
  }, [src])

  const label = title ? `Video player for ${title}` : 'Video player'

  return (
    <div
      className="relative aspect-video w-full overflow-hidden rounded-card border border-border bg-black"
      data-testid="video-player"
    >
      <video
        ref={videoRef}
        controls
        playsInline
        preload="metadata"
        poster={poster ?? undefined}
        aria-label={label}
        className="size-full bg-black"
      >
        {/* Graceful fallback for the (unsupported) no-JS / no-MSE case. */}
        <p className="p-4 text-sm text-muted">
          Your browser can&apos;t play this video.{' '}
          <a href={src} className="text-accent underline">
            Open the video stream
          </a>
          .
        </p>
      </video>

      {/* Loading overlay — sits over the poster until the manifest is ready.
          pointer-events-none so it never steals focus/clicks from the video. */}
      {status === 'loading' && (
        <div
          className="pointer-events-none absolute inset-0 grid place-items-center bg-black/40 backdrop-blur-[1px]"
          aria-hidden
        >
          <span className="flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1.5 text-xs font-medium text-muted">
            <Loader2 className="size-4 animate-spin text-accent" />
            Loading stream…
          </span>
        </div>
      )}

      {/* Error overlay — friendly message, no raw error leaked. */}
      {status === 'error' && (
        <div
          className="absolute inset-0 grid place-items-center bg-surface"
          role="alert"
          data-testid="video-player-error"
        >
          <div className="flex max-w-xs flex-col items-center gap-2 px-4 text-center">
            <AlertTriangle className="size-7 text-accent" aria-hidden />
            <p className="text-sm font-semibold text-foreground">
              Couldn&apos;t load this stream
            </p>
            <p className="text-xs text-muted">
              The video failed to play. Try another episode or check back later.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

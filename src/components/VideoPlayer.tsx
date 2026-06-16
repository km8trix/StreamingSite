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
// Report at most once per this many seconds of playback (plus a flush on
// pause/ended/tab-hide/unmount) so progress writes stay light.
const REPORT_INTERVAL_SECONDS = 10

export function VideoPlayer({
  src,
  poster,
  title,
  startSeconds,
  onProgress,
}: {
  src: string
  poster?: string | null
  title?: string
  /** Resume position (seconds) to seek to once metadata is ready. */
  startSeconds?: number
  /** Throttled progress callback: (positionSeconds, durationSeconds). */
  onProgress?: (positionSeconds: number, durationSeconds: number) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  )

  // Keep the latest callback / start position in refs so the player effect
  // (keyed on `src`) doesn't tear down and rebuild when they change identity.
  const onProgressRef = useRef(onProgress)
  const startSecondsRef = useRef(startSeconds)
  useEffect(() => {
    onProgressRef.current = onProgress
  }, [onProgress])
  useEffect(() => {
    startSecondsRef.current = startSeconds
  }, [startSeconds])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    // Reset state whenever the source changes (episode switch).
    setStatus('loading')

    let hls: import('hls.js').default | null = null
    let cancelled = false
    let seeked = false
    let lastReportedSecond = -REPORT_INTERVAL_SECONDS

    function markReady() {
      if (!cancelled) setStatus('ready')
    }

    const report = (force: boolean) => {
      if (cancelled) return
      const pos = Math.floor(video.currentTime || 0)
      const dur = Number.isFinite(video.duration) ? Math.floor(video.duration) : 0
      // Throttle by elapsed playback unless this is a forced flush.
      if (!force && Math.abs(pos - lastReportedSecond) < REPORT_INTERVAL_SECONDS) {
        return
      }
      lastReportedSecond = pos
      onProgressRef.current?.(pos, dur)
    }

    const onLoadedMetadata = () => {
      markReady() // covers native HLS; harmless duplicate for hls.js
      const start = startSecondsRef.current ?? 0
      if (!seeked && start > 0 && Number.isFinite(video.duration) && start < video.duration) {
        seeked = true
        try {
          video.currentTime = start
        } catch {
          // ignore — seeking can throw if the media isn't seekable yet
        }
      }
    }

    const onTimeUpdate = () => report(false)
    const onPause = () => report(true)
    const onEnded = () => report(true)
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') report(true)
    }

    video.addEventListener('loadedmetadata', onLoadedMetadata)
    video.addEventListener('timeupdate', onTimeUpdate)
    video.addEventListener('pause', onPause)
    video.addEventListener('ended', onEnded)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onPause)

    function onError() {
      if (!cancelled) setStatus('error')
    }

    // 1) Native HLS (Safari / iOS): assign the manifest URL directly.
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src
      video.addEventListener('error', onError)
    } else {
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
    }

    return () => {
      // Flush the final position BEFORE tearing down (native detach resets it).
      report(true)
      cancelled = true
      video.removeEventListener('loadedmetadata', onLoadedMetadata)
      video.removeEventListener('timeupdate', onTimeUpdate)
      video.removeEventListener('pause', onPause)
      video.removeEventListener('ended', onEnded)
      video.removeEventListener('error', onError)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onPause)
      if (hls) {
        hls.destroy()
        hls = null
      } else {
        video.removeAttribute('src')
        video.load()
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

// VideoPlayer.test.tsx — unit tests for the real HLS player.
//
// VideoPlayer is a 'use client' component that, in an effect keyed on `src`:
//   - if the browser can play HLS natively (Safari/iOS, i.e.
//     `video.canPlayType('application/vnd.apple.mpegurl')` is truthy) → sets
//     `video.src` to the manifest directly and uses NO hls.js;
//   - otherwise dynamically imports hls.js, constructs `new Hls()`, calls
//     `loadSource(src)` + `attachMedia(video)`, and on unmount/source-change
//     calls `hls.destroy()` (so there is no leak).
//
// We mock `hls.js` (vi.mock) and stub `HTMLMediaElement.prototype.canPlayType`
// (jsdom returns '' for everything) + `.load()` (unimplemented in jsdom) so both
// render paths are exercised deterministically without a real browser or network.

import { render, screen, waitFor, act, cleanup } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Mock hls.js BEFORE importing the component. The component does a dynamic
// `import('hls.js')` and reads `default`. We expose a controllable mock class
// with the bits the component touches: static `isSupported`/`Events`, and
// instance `on`/`loadSource`/`attachMedia`/`destroy`. Each constructed instance
// is captured so tests can assert on it and fire events.
// ---------------------------------------------------------------------------

const HLS_EVENTS = {
  MANIFEST_PARSED: 'hlsManifestParsed',
  ERROR: 'hlsError',
} as const

type Handler = (event: string, data?: unknown) => void

class MockHls {
  static instances: MockHls[] = []
  static isSupported = vi.fn(() => true)
  static Events = HLS_EVENTS

  config: unknown
  handlers = new Map<string, Handler[]>()
  loadSource = vi.fn()
  attachMedia = vi.fn()
  destroy = vi.fn()
  media: HTMLMediaElement | null = null

  constructor(config?: unknown) {
    this.config = config
    MockHls.instances.push(this)
  }

  on = vi.fn((event: string, handler: Handler) => {
    const list = this.handlers.get(event) ?? []
    list.push(handler)
    this.handlers.set(event, list)
  })

  // Test helper: synchronously dispatch a captured hls.js event.
  emit(event: string, data?: unknown) {
    for (const h of this.handlers.get(event) ?? []) h(event, data)
  }
}

vi.mock('hls.js', () => ({ default: MockHls }))

import { VideoPlayer } from './VideoPlayer'

const MANIFEST = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'

// jsdom doesn't implement HTMLMediaElement.load(); the native-HLS cleanup path
// calls it. Stub it (and restore between tests via the spies array).
let originalCanPlayType: HTMLMediaElement['canPlayType']

beforeEach(() => {
  MockHls.instances = []
  MockHls.isSupported = vi.fn(() => true)
  originalCanPlayType = HTMLMediaElement.prototype.canPlayType
  // Default: NOT native-HLS-capable → the hls.js path runs.
  HTMLMediaElement.prototype.canPlayType = vi.fn(() => '') as never
  // load() is unimplemented in jsdom.
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  HTMLMediaElement.prototype.canPlayType = originalCanPlayType
  vi.restoreAllMocks()
})

describe('VideoPlayer — native HLS path (Safari/iOS)', () => {
  beforeEach(() => {
    // Pretend the browser plays HLS natively.
    HTMLMediaElement.prototype.canPlayType = vi.fn(
      (type: string) =>
        type === 'application/vnd.apple.mpegurl' ? 'maybe' : '',
    ) as never
  })

  it('sets video.src to the manifest and does NOT construct hls.js', async () => {
    render(<VideoPlayer src={MANIFEST} title="Frieren — Episode 1" />)

    const video = document.querySelector('video') as HTMLVideoElement
    expect(video).not.toBeNull()

    await waitFor(() => {
      expect(video.src).toBe(MANIFEST)
    })
    // No hls.js instance was ever created on the native path.
    expect(MockHls.instances).toHaveLength(0)
  })

  it('checks canPlayType for the HLS mime type', () => {
    render(<VideoPlayer src={MANIFEST} />)
    const video = document.querySelector('video') as HTMLVideoElement
    expect(video.canPlayType).toHaveBeenCalledWith(
      'application/vnd.apple.mpegurl',
    )
  })

  it('clears the src on unmount (no lingering native request/leak)', async () => {
    const { unmount } = render(<VideoPlayer src={MANIFEST} />)
    const video = document.querySelector('video') as HTMLVideoElement
    await waitFor(() => expect(video.src).toBe(MANIFEST))

    const loadSpy = HTMLMediaElement.prototype.load as ReturnType<
      typeof vi.fn
    >
    unmount()

    // Cleanup removes the src attribute and calls load() to abort the fetch.
    expect(video.getAttribute('src')).toBeNull()
    expect(loadSpy).toHaveBeenCalled()
  })

  it('shows the error overlay when the native <video> emits an error', async () => {
    render(<VideoPlayer src={MANIFEST} />)
    const video = document.querySelector('video') as HTMLVideoElement
    await waitFor(() => expect(video.src).toBe(MANIFEST))

    await act(async () => {
      video.dispatchEvent(new Event('error'))
    })

    expect(screen.getByTestId('video-player-error')).toBeInTheDocument()
  })

  it('clears the error overlay (shows ready) on loadedmetadata', async () => {
    render(<VideoPlayer src={MANIFEST} />)
    const video = document.querySelector('video') as HTMLVideoElement
    await waitFor(() => expect(video.src).toBe(MANIFEST))

    await act(async () => {
      video.dispatchEvent(new Event('loadedmetadata'))
    })

    // Once ready, neither the loading nor the error overlay is shown.
    expect(screen.queryByTestId('video-player-error')).not.toBeInTheDocument()
    expect(screen.queryByText(/loading stream/i)).not.toBeInTheDocument()
  })
})

describe('VideoPlayer — hls.js (MSE) path', () => {
  it('constructs Hls, loadSource(src) + attachMedia(video) when not native', async () => {
    render(<VideoPlayer src={MANIFEST} title="Frieren — Episode 1" />)

    await waitFor(() => expect(MockHls.instances).toHaveLength(1))
    const inst = MockHls.instances[0]

    expect(inst.loadSource).toHaveBeenCalledWith(MANIFEST)
    expect(inst.attachMedia).toHaveBeenCalledTimes(1)

    const video = document.querySelector('video') as HTMLVideoElement
    expect(inst.attachMedia).toHaveBeenCalledWith(video)

    // The native path was NOT taken: video.src stays empty.
    expect(video.getAttribute('src')).toBeNull()
  })

  it('marks ready on MANIFEST_PARSED (loading overlay gone)', async () => {
    render(<VideoPlayer src={MANIFEST} />)
    await waitFor(() => expect(MockHls.instances).toHaveLength(1))
    const inst = MockHls.instances[0]

    // The loading overlay is present until the manifest parses.
    expect(screen.getByText(/loading stream/i)).toBeInTheDocument()

    await act(async () => {
      inst.emit(HLS_EVENTS.MANIFEST_PARSED)
    })

    expect(screen.queryByText(/loading stream/i)).not.toBeInTheDocument()
    expect(screen.queryByTestId('video-player-error')).not.toBeInTheDocument()
  })

  it('shows the error overlay on a FATAL hls.js error', async () => {
    render(<VideoPlayer src={MANIFEST} />)
    await waitFor(() => expect(MockHls.instances).toHaveLength(1))
    const inst = MockHls.instances[0]

    await act(async () => {
      inst.emit(HLS_EVENTS.ERROR, { fatal: true })
    })

    expect(screen.getByTestId('video-player-error')).toBeInTheDocument()
  })

  it('IGNORES non-fatal hls.js errors (no error overlay)', async () => {
    render(<VideoPlayer src={MANIFEST} />)
    await waitFor(() => expect(MockHls.instances).toHaveLength(1))
    const inst = MockHls.instances[0]

    await act(async () => {
      inst.emit(HLS_EVENTS.ERROR, { fatal: false })
    })

    expect(screen.queryByTestId('video-player-error')).not.toBeInTheDocument()
  })

  it('destroys the hls.js instance on unmount (no leak)', async () => {
    const { unmount } = render(<VideoPlayer src={MANIFEST} />)
    await waitFor(() => expect(MockHls.instances).toHaveLength(1))
    const inst = MockHls.instances[0]

    unmount()
    expect(inst.destroy).toHaveBeenCalledTimes(1)
  })

  it('tears down the old instance and builds a new one when src changes', async () => {
    const SRC_A = MANIFEST
    const SRC_B = 'https://test-streams.mux.dev/other/other.m3u8'

    const { rerender } = render(<VideoPlayer src={SRC_A} />)
    await waitFor(() => expect(MockHls.instances).toHaveLength(1))
    const first = MockHls.instances[0]
    expect(first.loadSource).toHaveBeenCalledWith(SRC_A)

    rerender(<VideoPlayer src={SRC_B} />)
    // Old instance destroyed; a fresh one created and pointed at the new source.
    await waitFor(() => expect(MockHls.instances).toHaveLength(2))
    expect(first.destroy).toHaveBeenCalledTimes(1)
    expect(MockHls.instances[1].loadSource).toHaveBeenCalledWith(SRC_B)
  })

  it('shows the error overlay when MSE is unsupported (Hls.isSupported() false)', async () => {
    MockHls.isSupported = vi.fn(() => false)
    render(<VideoPlayer src={MANIFEST} />)

    await waitFor(() =>
      expect(screen.getByTestId('video-player-error')).toBeInTheDocument(),
    )
    // No instance is constructed when MSE isn't supported.
    expect(MockHls.instances).toHaveLength(0)
  })
})

describe('VideoPlayer — structure / accessibility', () => {
  it('renders a real <video> with controls inside the video-player container', () => {
    render(<VideoPlayer src={MANIFEST} />)
    const container = screen.getByTestId('video-player')
    const video = container.querySelector('video')
    expect(video).not.toBeNull()
    expect(video).toHaveAttribute('controls')
    expect(video).toHaveAttribute('playsInline')
  })

  it('labels the player with the title when provided', () => {
    render(<VideoPlayer src={MANIFEST} title="Cowboy Bebop — Episode 1" />)
    expect(
      screen.getByLabelText('Video player for Cowboy Bebop — Episode 1'),
    ).toBeInTheDocument()
  })

  it('uses a generic accessible label when no title is provided', () => {
    render(<VideoPlayer src={MANIFEST} />)
    expect(screen.getByLabelText('Video player')).toBeInTheDocument()
  })

  it('does NOT autoplay (no autoplay attribute on the video)', () => {
    render(<VideoPlayer src={MANIFEST} />)
    const video = document.querySelector('video') as HTMLVideoElement
    expect(video).not.toHaveAttribute('autoplay')
  })
})

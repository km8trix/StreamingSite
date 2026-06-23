import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AdSenseScript } from './AdSenseScript'

// Mock next/script as a marker capturing its props. (A real <script async> is
// hoisted to <head> by React 19, so it wouldn't be queryable in the container.)
vi.mock('next/script', () => ({
  default: ({ src, crossOrigin }: { src: string; crossOrigin?: string }) => (
    <div data-testid="next-script" data-src={src} data-cors={crossOrigin} />
  ),
}))

afterEach(() => vi.unstubAllEnvs())

describe('AdSenseScript', () => {
  it('renders nothing when the publisher id is unset', () => {
    render(<AdSenseScript />)
    expect(screen.queryByTestId('next-script')).toBeNull()
  })

  it('loads the adsbygoogle script with the configured client id', () => {
    vi.stubEnv('NEXT_PUBLIC_ADSENSE_CLIENT', 'ca-pub-1191181818524233')
    render(<AdSenseScript />)
    const script = screen.getByTestId('next-script')
    expect(script).toHaveAttribute(
      'data-src',
      'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1191181818524233',
    )
    expect(script).toHaveAttribute('data-cors', 'anonymous')
  })
})

import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AdSenseScript } from './AdSenseScript'

// React hoists <script async> to <head>, so query the whole document and clean
// up hoisted nodes between tests.
const adsScript = () =>
  document.querySelector('script[src*="adsbygoogle.js"]')

afterEach(() => {
  vi.unstubAllEnvs()
  document
    .querySelectorAll('script[src*="adsbygoogle.js"]')
    .forEach((s) => s.remove())
})

describe('AdSenseScript', () => {
  it('renders no script when the publisher id is unset', () => {
    render(<AdSenseScript />)
    expect(adsScript()).toBeNull()
  })

  it('renders the AdSense loader with the configured client id', () => {
    vi.stubEnv('NEXT_PUBLIC_ADSENSE_CLIENT', 'ca-pub-1191181818524233')
    render(<AdSenseScript />)
    const s = adsScript()
    expect(s).not.toBeNull()
    expect(s!.getAttribute('src')).toBe(
      'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1191181818524233',
    )
    expect(s!.getAttribute('crossorigin')).toBe('anonymous')
  })
})

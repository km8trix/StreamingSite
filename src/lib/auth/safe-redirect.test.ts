import { describe, expect, it } from 'vitest'
import { safeRedirectPath } from './safe-redirect'

describe('safeRedirectPath', () => {
  it('passes through clean same-origin relative paths', () => {
    expect(safeRedirectPath('/')).toBe('/')
    expect(safeRedirectPath('/profile')).toBe('/profile')
    expect(safeRedirectPath('/shows/naruto')).toBe('/shows/naruto')
    expect(safeRedirectPath('/search?q=one+piece&genre=action')).toBe(
      '/search?q=one+piece&genre=action',
    )
    expect(safeRedirectPath('/forum/thread/123#reply')).toBe(
      '/forum/thread/123#reply',
    )
  })

  it('falls back to "/" for null / undefined / empty / whitespace', () => {
    expect(safeRedirectPath(null)).toBe('/')
    expect(safeRedirectPath(undefined)).toBe('/')
    expect(safeRedirectPath('')).toBe('/')
    expect(safeRedirectPath('   ')).toBe('/')
  })

  it('honors a custom fallback', () => {
    expect(safeRedirectPath(null, '/home')).toBe('/home')
    expect(safeRedirectPath('https://evil.com', '/home')).toBe('/home')
  })

  it('rejects absolute URLs (no leading slash)', () => {
    expect(safeRedirectPath('https://evil.com')).toBe('/')
    expect(safeRedirectPath('http://evil.com/path')).toBe('/')
    expect(safeRedirectPath('evil.com')).toBe('/')
    expect(safeRedirectPath('javascript:alert(1)')).toBe('/')
    expect(safeRedirectPath('mailto:a@b.com')).toBe('/')
  })

  it('rejects protocol-relative URLs ("//host")', () => {
    expect(safeRedirectPath('//evil.com')).toBe('/')
    expect(safeRedirectPath('//evil.com/path?x=1')).toBe('/')
  })

  it('rejects backslash-folding tricks browsers normalize to "//"', () => {
    expect(safeRedirectPath('/\\evil.com')).toBe('/')
    expect(safeRedirectPath('/\\/evil.com')).toBe('/')
    expect(safeRedirectPath('\\\\evil.com')).toBe('/')
    expect(safeRedirectPath('/path\\with\\backslash')).toBe('/')
  })

  it('rejects control characters and embedded whitespace tricks', () => {
    expect(safeRedirectPath('/\tevil')).toBe('/')
    expect(safeRedirectPath('/\nevil')).toBe('/')
    expect(safeRedirectPath('/foo\r\nSet-Cookie: x')).toBe('/')
    expect(safeRedirectPath('/\x00bar')).toBe('/')
  })

  it('rejects values exceeding the length cap', () => {
    expect(safeRedirectPath('/' + 'a'.repeat(600))).toBe('/')
  })
})

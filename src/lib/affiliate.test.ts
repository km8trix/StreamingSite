import { afterEach, describe, expect, it, vi } from 'vitest'
import { tagAffiliateUrl } from './affiliate'

afterEach(() => vi.unstubAllEnvs())

const withTag = () => vi.stubEnv('NEXT_PUBLIC_AFFILIATE_AMAZON', 'senpai063-20')

describe('tagAffiliateUrl', () => {
  it('appends the Amazon Associates tag to amazon.* product URLs', () => {
    withTag()
    expect(tagAffiliateUrl('https://www.amazon.com/dp/B00ABCDEF')).toBe(
      'https://www.amazon.com/dp/B00ABCDEF?tag=senpai063-20',
    )
    // Other Amazon TLDs and subdomains too.
    expect(tagAffiliateUrl('https://amazon.co.jp/dp/X')).toContain('tag=senpai063-20')
    expect(tagAffiliateUrl('https://smile.amazon.com/dp/X')).toContain('tag=senpai063-20')
  })

  it('is idempotent — re-tagging overwrites, never duplicates', () => {
    withTag()
    const once = tagAffiliateUrl('https://www.amazon.com/dp/X')
    const twice = tagAffiliateUrl(once)
    expect(twice).toBe(once)
    expect(twice.match(/tag=/g)).toHaveLength(1)
  })

  it('preserves existing query params', () => {
    withTag()
    expect(tagAffiliateUrl('https://www.amazon.com/dp/X?th=1')).toBe(
      'https://www.amazon.com/dp/X?th=1&tag=senpai063-20',
    )
  })

  it('passes non-Amazon hosts through unchanged', () => {
    withTag()
    const cr = 'https://www.crunchyroll.com/series/x'
    expect(tagAffiliateUrl(cr)).toBe(cr)
    // Look-alike host must NOT be tagged.
    const evil = 'https://amazon.evil.com/dp/X'
    expect(tagAffiliateUrl(evil)).toBe(evil)
  })

  it('is a no-op (verbatim) when no tag is configured', () => {
    const url = 'https://www.amazon.com/dp/X'
    expect(tagAffiliateUrl(url)).toBe(url)
  })

  it('returns the original string for a malformed or non-http URL', () => {
    withTag()
    expect(tagAffiliateUrl('not a url')).toBe('not a url')
    expect(tagAffiliateUrl('javascript:alert(1)')).toBe('javascript:alert(1)')
  })
})

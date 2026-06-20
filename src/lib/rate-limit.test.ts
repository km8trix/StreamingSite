import { beforeEach, describe, expect, it } from 'vitest'
import type { NextRequest } from 'next/server'
import {
  __resetRateLimitStore,
  checkRateLimit,
  clientIp,
  enforceRateLimit,
} from './rate-limit'

// Build a minimal NextRequest-like object — enforceRateLimit/clientIp only read
// request.headers.get().
function req(headers: Record<string, string> = {}): NextRequest {
  return { headers: new Headers(headers) } as unknown as NextRequest
}

beforeEach(() => __resetRateLimitStore())

describe('checkRateLimit', () => {
  it('allows requests under the limit and decrements remaining', () => {
    const a = checkRateLimit('k', 3, 1000, 0)
    expect(a).toMatchObject({ allowed: true, limit: 3, remaining: 2 })
    const b = checkRateLimit('k', 3, 1000, 0)
    expect(b).toMatchObject({ allowed: true, remaining: 1 })
    const c = checkRateLimit('k', 3, 1000, 0)
    expect(c).toMatchObject({ allowed: true, remaining: 0 })
  })

  it('blocks once the limit is reached within the window', () => {
    checkRateLimit('k', 2, 1000, 0)
    checkRateLimit('k', 2, 1000, 0)
    const blocked = checkRateLimit('k', 2, 1000, 500)
    expect(blocked).toMatchObject({ allowed: false, remaining: 0 })
  })

  it('resets after the window elapses', () => {
    checkRateLimit('k', 1, 1000, 0)
    expect(checkRateLimit('k', 1, 1000, 500).allowed).toBe(false)
    // now past resetAt (0 + 1000)
    expect(checkRateLimit('k', 1, 1000, 1000).allowed).toBe(true)
  })

  it('tracks separate keys independently', () => {
    checkRateLimit('a', 1, 1000, 0)
    expect(checkRateLimit('a', 1, 1000, 0).allowed).toBe(false)
    expect(checkRateLimit('b', 1, 1000, 0).allowed).toBe(true)
  })
})

describe('clientIp', () => {
  it('takes the first x-forwarded-for entry', () => {
    expect(clientIp(req({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }))).toBe('1.2.3.4')
  })
  it('falls back to x-real-ip', () => {
    expect(clientIp(req({ 'x-real-ip': '9.9.9.9' }))).toBe('9.9.9.9')
  })
  it('returns "unknown" with no IP headers', () => {
    expect(clientIp(req())).toBe('unknown')
  })
})

describe('enforceRateLimit', () => {
  it('exempts loopback / unknown IPs (returns null to proceed)', () => {
    expect(enforceRateLimit(req(), { name: 'x', limit: 1, windowMs: 1000 })).toBeNull()
    expect(
      enforceRateLimit(req({ 'x-forwarded-for': '127.0.0.1' }), {
        name: 'x',
        limit: 1,
        windowMs: 1000,
      }),
    ).toBeNull()
    expect(
      enforceRateLimit(req({ 'x-forwarded-for': '::1' }), {
        name: 'x',
        limit: 1,
        windowMs: 1000,
      }),
    ).toBeNull()
  })

  it('allows a real IP under the limit, then 429s with Retry-After over it', async () => {
    const r = req({ 'x-forwarded-for': '203.0.113.7' })
    const rule = { name: 'api', limit: 2, windowMs: 60_000 }
    expect(enforceRateLimit(r, rule)).toBeNull()
    expect(enforceRateLimit(r, rule)).toBeNull()
    const blocked = enforceRateLimit(r, rule)
    expect(blocked).not.toBeNull()
    expect(blocked!.status).toBe(429)
    expect(Number(blocked!.headers.get('Retry-After'))).toBeGreaterThan(0)
    expect(blocked!.headers.get('RateLimit-Limit')).toBe('2')
    const body = await blocked!.json()
    expect(body.error).toMatch(/too many requests/i)
  })

  it('scopes the limit per IP', () => {
    const rule = { name: 'api', limit: 1, windowMs: 60_000 }
    expect(enforceRateLimit(req({ 'x-forwarded-for': '1.1.1.1' }), rule)).toBeNull()
    expect(enforceRateLimit(req({ 'x-forwarded-for': '1.1.1.1' }), rule)).not.toBeNull()
    // A different IP is unaffected.
    expect(enforceRateLimit(req({ 'x-forwarded-for': '2.2.2.2' }), rule)).toBeNull()
  })
})

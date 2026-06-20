import { beforeEach, describe, expect, it, vi } from 'vitest'
import { __resetRateLimitStore } from '@/lib/rate-limit'
import { rateLimitAction, tooManyMessage } from './rate-limit-action'

// Drive the mocked `await headers()` per test. vi.hoisted so the mock factory
// can reference it without a TDZ.
const h = vi.hoisted(() => ({ value: new Headers() }))
vi.mock('next/headers', () => ({ headers: async () => h.value }))

beforeEach(() => {
  __resetRateLimitStore()
  h.value = new Headers()
})

describe('tooManyMessage', () => {
  it('is a generic wait message under a minute', () => {
    expect(tooManyMessage(1)).toMatch(/wait a moment/i)
    expect(tooManyMessage(59)).toMatch(/wait a moment/i)
  })
  it('reports minutes, singular vs plural', () => {
    expect(tooManyMessage(60)).toMatch(/\b1 minute\b/)
    expect(tooManyMessage(125)).toMatch(/\b3 minutes\b/) // ceil(125/60)
  })
})

describe('rateLimitAction', () => {
  const rule = { name: 'test-action', limit: 2, windowMs: 60_000 }

  it('exempts loopback / unknown IPs — never counts, always proceeds', async () => {
    // No x-forwarded-for → clientIp is "unknown" → exempt.
    expect(await rateLimitAction(rule)).toBeNull()
    expect(await rateLimitAction(rule)).toBeNull()
    expect(await rateLimitAction(rule)).toBeNull()

    h.value = new Headers({ 'x-forwarded-for': '127.0.0.1' })
    expect(await rateLimitAction(rule)).toBeNull()
  })

  it('allows under the limit, then returns an { error } over it', async () => {
    h.value = new Headers({ 'x-forwarded-for': '203.0.113.5' })
    expect(await rateLimitAction(rule)).toBeNull()
    expect(await rateLimitAction(rule)).toBeNull()
    const blocked = await rateLimitAction(rule)
    expect(blocked).not.toBeNull()
    expect(blocked!.error).toMatch(/too many/i)
  })

  it('scopes the limit per IP', async () => {
    h.value = new Headers({ 'x-forwarded-for': '203.0.113.5' })
    await rateLimitAction(rule)
    await rateLimitAction(rule)
    expect(await rateLimitAction(rule)).not.toBeNull() // .5 is now blocked

    h.value = new Headers({ 'x-forwarded-for': '203.0.113.6' })
    expect(await rateLimitAction(rule)).toBeNull() // a different IP is fresh
  })
})

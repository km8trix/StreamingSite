import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'
import { __resetRateLimitStore } from '@/lib/rate-limit'
import { RATE_LIMITS } from '@/lib/rate-limit-rules'

// The callback is the ONLY guarded surface that is a Route Handler (not a Server
// Action) and the only one using the `if (await rateLimitByHeaders(...))` shape,
// so its wiring (correct rule, exempt loopback, block→/signin) needs its own
// proof. Stub the Supabase code-exchange so we exercise routing, not real auth.
const exchange = vi.hoisted(() => ({
  fn: vi.fn(async () => ({ error: null as { message: string } | null })),
}))
vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({ auth: { exchangeCodeForSession: exchange.fn } }),
}))
vi.mock('@/lib/supabase/config', () => ({
  SUPABASE_URL: 'http://localhost:54321',
  SUPABASE_ANON_KEY: 'anon-key',
  isSupabaseConfigured: () => true,
}))

import { GET } from './route'

function req(ip?: string): NextRequest {
  const url = new URL('https://app.example.test/auth/callback')
  url.searchParams.set('code', 'auth-code')
  const headers = new Headers()
  if (ip) headers.set('x-forwarded-for', ip)
  return {
    nextUrl: url,
    headers,
    cookies: { getAll: () => [] },
  } as unknown as NextRequest
}

function locationOf(res: Response): URL {
  return new URL(res.headers.get('location') as string)
}

beforeEach(() => {
  __resetRateLimitStore()
  exchange.fn.mockClear()
})

describe('OAuth callback rate limiting', () => {
  it('exchanges the code under the limit, then throttles a flood to /signin', async () => {
    const ip = '203.0.113.77'
    const limit = RATE_LIMITS.oauthCallback.limit

    for (let i = 0; i < limit; i++) {
      const res = await GET(req(ip))
      expect(locationOf(res).pathname).toBe('/') // success → redirect to next ("/")
    }
    expect(exchange.fn).toHaveBeenCalledTimes(limit)

    const blocked = await GET(req(ip))
    const loc = locationOf(blocked)
    expect(loc.pathname).toBe('/signin')
    expect(loc.searchParams.get('error')).toMatch(/too many/i)
    // The blocked request short-circuited before the Supabase exchange.
    expect(exchange.fn).toHaveBeenCalledTimes(limit)
  })

  it('never throttles an exempt (loopback / unknown) IP', async () => {
    for (let i = 0; i < RATE_LIMITS.oauthCallback.limit + 5; i++) {
      const res = await GET(req()) // no x-forwarded-for → "unknown" → exempt
      expect(locationOf(res).pathname).toBe('/')
    }
  })
})

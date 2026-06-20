import type { NextRequest } from 'next/server'

// Rate limiting for public API routes — a coarse abuse guard.
//
// SCOPE / HONESTY: the store is an in-process Map, so on Vercel's serverless
// functions each instance keeps its OWN counters — this is per-instance,
// best-effort protection that blunts bursts to a warm instance, NOT a global
// quota. A shared store (Upstash Redis) is the production upgrade: swap the
// `store` get/set for Redis INCR + EXPIRE behind the same checkRateLimit() shape
// and set UPSTASH_REDIS_REST_URL/TOKEN. The call sites and tests stay unchanged.
//
// Loopback / unknown client IPs are EXEMPT: on Vercel the trusted edge always
// sets a real public x-forwarded-for, so loopback only appears locally / in
// tests (where shared-IP bursts would otherwise cause false positives).

export type RateLimitResult = {
  allowed: boolean
  limit: number
  remaining: number
  resetAt: number // epoch ms when the current window resets
}

type Bucket = { count: number; resetAt: number }
const store = new Map<string, Bucket>()

/** Test seam: clear all in-memory buckets. */
export function __resetRateLimitStore(): void {
  store.clear()
}

/**
 * Fixed-window counter. Pure given (key, limit, windowMs, now) + the module
 * store; pass `now` in tests to advance windows deterministically.
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): RateLimitResult {
  const existing = store.get(key)

  if (!existing || now >= existing.resetAt) {
    const resetAt = now + windowMs
    store.set(key, { count: 1, resetAt })
    // Opportunistic prune so the map can't grow unbounded under many keys.
    if (store.size > 10_000) {
      for (const [k, b] of store) if (now >= b.resetAt) store.delete(k)
    }
    return { allowed: true, limit, remaining: limit - 1, resetAt }
  }

  if (existing.count >= limit) {
    return { allowed: false, limit, remaining: 0, resetAt: existing.resetAt }
  }

  existing.count += 1
  return {
    allowed: true,
    limit,
    remaining: limit - existing.count,
    resetAt: existing.resetAt,
  }
}

/** The client IP from the trusted edge headers, or 'unknown'. */
export function clientIp(request: NextRequest): string {
  const xff = request.headers.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  return request.headers.get('x-real-ip')?.trim() || 'unknown'
}

function isExempt(ip: string): boolean {
  return (
    ip === 'unknown' ||
    ip === '::1' ||
    ip === 'localhost' ||
    ip.startsWith('127.')
  )
}

export type RateLimitRule = { name: string; limit: number; windowMs: number }

/**
 * Enforce a rule for the request's client IP. Returns a 429 Response when over
 * the limit (with Retry-After + RateLimit-* headers), or null to proceed.
 * Loopback / unknown IPs are exempt (proceed).
 */
export function enforceRateLimit(
  request: NextRequest,
  rule: RateLimitRule,
): Response | null {
  const ip = clientIp(request)
  if (isExempt(ip)) return null

  const result = checkRateLimit(
    `${rule.name}:${ip}`,
    rule.limit,
    rule.windowMs,
  )
  if (result.allowed) return null

  const retryAfter = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000))
  return Response.json(
    { error: 'Too many requests. Please slow down.' },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfter),
        'RateLimit-Limit': String(result.limit),
        'RateLimit-Remaining': String(result.remaining),
        'RateLimit-Reset': String(retryAfter),
      },
    },
  )
}

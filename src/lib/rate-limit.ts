import type { NextRequest } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// Rate limiting for public API routes — a coarse abuse guard.
//
// TWO STORES, chosen at runtime:
//   - Upstash Redis (PRODUCTION): a shared, atomic fixed-window counter that
//     enforces ONE global quota across every serverless instance. Active when
//     UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set.
//   - In-process Map (FALLBACK): used when those env vars are absent (local dev,
//     tests) or if Redis is momentarily unreachable. Each Vercel instance keeps
//     its OWN counters, so this is per-instance best-effort — it blunts bursts to
//     a warm instance but is NOT a global quota.
// Both produce the same RateLimitResult shape, so call sites are store-agnostic.
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

/** Test seam: clear all in-memory buckets + drop any cached Redis limiters. */
export function __resetRateLimitStore(): void {
  store.clear()
  limiters.clear()
  redis = undefined
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

// --- Upstash Redis store (production) ------------------------------------
//
// A Ratelimit binds its limit + window at construction, so we cache one instance
// per distinct (limit, windowMs) rule. `redis` is memoized as null when the env
// vars are absent so we don't probe process.env on every request.

let redis: Redis | null | undefined
const limiters = new Map<string, Ratelimit>()

function getRedis(): Redis | null {
  if (redis !== undefined) return redis
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  redis = url && token ? new Redis({ url, token }) : null
  return redis
}

function getLimiter(rule: RateLimitRule): Ratelimit | null {
  const r = getRedis()
  if (!r) return null
  const key = `${rule.limit}:${rule.windowMs}`
  let limiter = limiters.get(key)
  if (!limiter) {
    limiter = new Ratelimit({
      redis: r,
      // Match the in-memory limiter's fixed-window semantics exactly.
      limiter: Ratelimit.fixedWindow(rule.limit, `${rule.windowMs} ms`),
      prefix: 'rl',
    })
    limiters.set(key, limiter)
  }
  return limiter
}

/**
 * Apply `rule` to `key` using Redis when configured, else the in-memory store.
 * If a configured Redis call throws (network blip, quota), we fail soft to the
 * in-memory limiter — keeping per-instance protection rather than 500-ing or
 * leaving the route unguarded.
 */
async function applyLimit(
  key: string,
  rule: RateLimitRule,
): Promise<RateLimitResult> {
  const limiter = getLimiter(rule)
  if (limiter) {
    try {
      const r = await limiter.limit(key)
      return {
        allowed: r.success,
        limit: r.limit,
        remaining: r.remaining,
        resetAt: r.reset, // unix ms — same meaning as the in-memory resetAt
      }
    } catch {
      // fall through to the in-memory limiter
    }
  }
  return checkRateLimit(key, rule.limit, rule.windowMs)
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
 * Loopback / unknown IPs are exempt (proceed). Async because the Redis store is
 * awaited; the in-memory fallback resolves synchronously.
 */
export async function enforceRateLimit(
  request: NextRequest,
  rule: RateLimitRule,
): Promise<Response | null> {
  const ip = clientIp(request)
  if (isExempt(ip)) return null

  const result = await applyLimit(`${rule.name}:${ip}`, rule)
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

import { headers } from 'next/headers'
import { rateLimitByHeaders, type RateLimitRule } from './rate-limit'

// Rate-limit guard for SERVER ACTIONS. Unlike route handlers, a Server Action
// can't emit an HTTP 429 — it returns a plain object the form renders. So this
// reads the client IP from `await headers()` and, when over the limit, returns
// an `{ error }` the action returns verbatim (matching AuthResult /
// CommentActionResult / ForumActionResult). Returns null to proceed.
//
// Loopback / unknown IPs are exempt (handled in rateLimitByHeaders), so local
// dev and the e2e suite (which run against localhost) are never throttled.

/** Human-friendly "try again later" message scaled to the retry window. */
export function tooManyMessage(retryAfterSeconds: number): string {
  if (retryAfterSeconds < 60) {
    return 'Too many attempts. Please wait a moment and try again.'
  }
  const minutes = Math.ceil(retryAfterSeconds / 60)
  return `Too many attempts. Please try again in about ${minutes} minute${
    minutes === 1 ? '' : 's'
  }.`
}

/**
 * Apply `rule` to the current request's client IP. Returns `{ error }` when over
 * the limit (return it straight from the action), or `null` to proceed.
 */
export async function rateLimitAction(
  rule: RateLimitRule,
): Promise<{ error: string } | null> {
  const blocked = await rateLimitByHeaders(await headers(), rule)
  if (!blocked) return null
  return { error: tooManyMessage(blocked.retryAfterSeconds) }
}

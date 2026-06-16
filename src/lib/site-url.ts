import { headers } from 'next/headers'

/**
 * Resolve the app's own public origin (scheme + host, no trailing slash) for
 * building absolute OAuth redirect URLs (`<origin>/auth/callback`).
 *
 * Derived from the ACTUAL request host so the OAuth round-trip always returns to
 * the exact domain the user is on — where the PKCE verifier and session cookies
 * live. This deliberately does NOT read NEXT_PUBLIC_SITE_URL: a mis-set value
 * there silently broke sign-in (the session cookie landed on the wrong host).
 *
 * Safe without that env var: on Vercel the trusted edge sets x-forwarded-host /
 * host to the real deployment host (client-spoofed values are overwritten), and
 * the resulting redirectTo is additionally validated against Supabase's
 * Redirect-URL allowlist. Server-only (reads request headers) — call from Server
 * Actions / Route Handlers.
 */
export async function getSiteOrigin(): Promise<string> {
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host')
  if (host) {
    const isLocal = host.startsWith('localhost') || host.startsWith('127.')
    const proto = h.get('x-forwarded-proto') ?? (isLocal ? 'http' : 'https')
    return `${proto}://${host}`
  }
  return 'http://localhost:3000'
}

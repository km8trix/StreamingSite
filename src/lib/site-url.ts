import { headers } from 'next/headers'

/**
 * Resolve the app's own public origin (scheme + host, no trailing slash) for
 * building absolute OAuth redirect URLs (`<origin>/auth/callback`).
 *
 * Order of preference:
 *   1. NEXT_PUBLIC_SITE_URL — set this in production. It MUST match an entry in
 *      the Supabase dashboard's Auth → URL Configuration "Redirect URLs"
 *      allowlist, so a fixed env value is the reliable source of truth.
 *   2. The request's forwarded host headers (x-forwarded-host / host), so local
 *      dev and preview deploys work without extra config.
 *   3. http://localhost:3000 as a last resort.
 *
 * Server-only (reads request headers). Call from Server Actions / Route Handlers.
 */
export async function getSiteOrigin(): Promise<string> {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (fromEnv) return fromEnv.replace(/\/+$/, '')

  // Fallback for local dev / preview when the env var is unset. This value is
  // only ever used to build the OAuth `redirectTo`, which Supabase validates
  // against its server-side Redirect-URL allowlist — so a spoofed forwarding
  // header here can't cause an open redirect (Supabase rejects a non-allowlisted
  // target). In production, set NEXT_PUBLIC_SITE_URL so this path is never taken.
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host')
  if (host) {
    const isLocal = host.startsWith('localhost') || host.startsWith('127.')
    const proto =
      h.get('x-forwarded-proto') ?? (isLocal ? 'http' : 'https')
    return `${proto}://${host}`
  }

  return 'http://localhost:3000'
}

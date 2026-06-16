// OAuth callback (PKCE code exchange).
//
// Google (and any future OAuth provider) redirects the browser back here with
// `?code=<auth-code>` after the user consents. We exchange that code for a
// Supabase session — exchangeCodeForSession() reads the PKCE code-verifier
// cookie (sent on the request) and, on success, writes the `sb-…-auth-token`
// session cookies.
//
// IMPORTANT (production correctness): in a Route Handler the session cookies must
// be written DIRECTLY onto the NextResponse we return. Relying on the
// next/headers cookies() adapter to auto-merge onto a manually-constructed
// NextResponse.redirect() does NOT reliably persist them (the user lands signed
// OUT with no error). So we build the redirect response first and give the
// Supabase client a setAll that sets cookies on that exact response — the same
// reliable pattern used by middleware (src/lib/supabase/middleware.ts).
//
// On any error (provider returned ?error, missing code, or a failed exchange)
// we bounce back to /signin with a human-readable `?error=` message.
//
// `next` is OPEN-REDIRECT-sanitized (safeRedirectPath) so a crafted callback
// link can't land the user off-site.

import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import type { Database } from '@/lib/database.types'
import {
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
  isSupabaseConfigured,
} from '@/lib/supabase/config'
import { safeRedirectPath } from '@/lib/auth/safe-redirect'

// Per-request code exchange — never cache.
export const dynamic = 'force-dynamic'

/**
 * The public base URL to redirect to, derived from the actual request origin so
 * the user returns to the exact domain they signed in from (where the session
 * cookie is set). On Vercel `nextUrl.origin` reflects the real edge-validated
 * host — not client-spoofable — so this is safe and needs no NEXT_PUBLIC_SITE_URL
 * (a mis-set value there silently broke sign-in by redirecting off-domain).
 */
function resolveBaseUrl(request: NextRequest): string {
  return request.nextUrl.origin
}

function redirectToSignin(base: string, message: string): NextResponse {
  const dest = new URL('/signin', base)
  dest.searchParams.set('error', message.slice(0, 300))
  return NextResponse.redirect(dest)
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const params = request.nextUrl.searchParams
  const base = resolveBaseUrl(request)
  const next = safeRedirectPath(params.get('next'))

  // The provider can redirect back with an error (e.g. the user clicked Cancel).
  const providerError = params.get('error_description') ?? params.get('error')
  if (providerError) {
    return redirectToSignin(base, providerError)
  }

  const code = params.get('code')
  if (!code) {
    return redirectToSignin(
      base,
      'No authorization code was returned. Please try signing in again.',
    )
  }

  if (!isSupabaseConfigured()) {
    return redirectToSignin(base, 'Authentication is not configured.')
  }

  // Build the success redirect FIRST so the Supabase client writes the session
  // cookies straight onto it (reliable; see the file header).
  const response = NextResponse.redirect(new URL(next, base))

  const supabase = createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options)
        }
      },
    },
  })

  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    return redirectToSignin(base, error.message)
  }

  return response
}

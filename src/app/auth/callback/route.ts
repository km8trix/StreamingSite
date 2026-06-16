// OAuth callback (PKCE code exchange).
//
// Google (and any future OAuth provider) redirects the browser back here with
// `?code=<auth-code>` after the user consents. We exchange that code for a
// Supabase session — exchangeCodeForSession() reads the PKCE code-verifier
// cookie set by signInWithOAuth() and, on success, writes the `sb-…-auth-token`
// session cookies via the @supabase/ssr cookie adapter. Those cookie writes are
// attached to the NextResponse.redirect() we return, so the user lands signed in.
//
// On any error (provider returned ?error, missing code, or a failed exchange)
// we bounce back to /signin with a human-readable `?error=` message instead of
// leaving the user on a blank page.
//
// `next` is an OPEN-REDIRECT-sanitized relative path (safeRedirectPath) so an
// attacker can't craft a callback link that lands the user off-site.

import { NextResponse, type NextRequest } from 'next/server'
import { getServerClient } from '@/lib/supabase/server'
import { safeRedirectPath } from '@/lib/auth/safe-redirect'

// Per-request code exchange — never cache.
export const dynamic = 'force-dynamic'

/**
 * The TRUSTED public base URL to redirect to. We deliberately do NOT read the
 * raw `x-forwarded-host` header here: a client-supplied (or proxy-forwarded)
 * value would let an attacker set the redirect ORIGIN to their own domain,
 * sidestepping safeRedirectPath() (which only constrains the PATH) and turning
 * this route into an open redirect — the error branch fires on any request
 * without a valid `code`, so no session is even required.
 *
 * Instead we use a fixed, trusted source: NEXT_PUBLIC_SITE_URL when set (the
 * production recommendation), otherwise `request.nextUrl.origin`, which Next
 * derives from the platform-validated host (on Vercel the edge overwrites any
 * client-spoofed forwarding headers with the real host).
 */
function resolveBaseUrl(request: NextRequest): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (fromEnv) return fromEnv.replace(/\/+$/, '')
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
  const providerError =
    params.get('error_description') ?? params.get('error')
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

  const supabase = await getServerClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    return redirectToSignin(base, error.message)
  }

  return NextResponse.redirect(new URL(next, base))
}

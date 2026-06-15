// Session-refresh helper for Next middleware (the standard @supabase/ssr
// `updateSession` pattern). Runs on every matched request, reads the auth
// cookies, lets Supabase refresh the access/refresh tokens when needed, and
// writes the rotated cookies back onto BOTH the request (so the same request,
// if it reaches a Server Component, sees the fresh session) and the response
// (so the browser stores them).
//
// IMPORTANT: do not run other logic between createServerClient() and
// supabase.auth.getUser() — getUser() is what actually validates/refreshes the
// session, and reordering can desync the cookies.

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/lib/database.types'
import {
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
  isSupabaseConfigured,
} from './config'

export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let supabaseResponse = NextResponse.next({ request })

  // When Supabase isn't configured (e.g. a build/preview without env), there is
  // no session to refresh — pass the request straight through.
  if (!isSupabaseConfigured()) {
    return supabaseResponse
  }

  const supabase = createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        // Mirror onto the request so downstream Server Components read the
        // refreshed session…
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value)
        }
        // …and re-create the response so the rotated cookies reach the browser.
        supabaseResponse = NextResponse.next({ request })
        for (const { name, value, options } of cookiesToSet) {
          supabaseResponse.cookies.set(name, value, options)
        }
      },
    },
  })

  // Refresh the session. getUser() revalidates the JWT with the auth server and
  // triggers setAll() above when tokens rotate. We intentionally ignore the
  // result here — gating/redirects happen in the route layer, not middleware.
  await supabase.auth.getUser()

  return supabaseResponse
}

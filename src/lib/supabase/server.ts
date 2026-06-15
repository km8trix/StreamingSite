// Server-side Supabase client (Server Components, Route Handlers, Server Actions).
// Next 16: cookies() is async and must be awaited.
//
// For Milestone 1 the catalog is public-read only, so cookie *writes* aren't
// needed. We still wire getAll/setAll per the @supabase/ssr contract; setAll
// is wrapped in try/catch because Server Components cannot set cookies (that's
// expected and harmless for read-only anon queries).

import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from './config'

export async function getServerClient() {
  if (!isSupabaseConfigured()) {
    throw new Error(
      'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY, or rely on the seed fallback in src/lib/data.',
    )
  }

  const cookieStore = await cookies()

  return createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Called from a Server Component where cookies are read-only.
          // Safe to ignore for anon read-only access; a middleware would
          // handle session refresh in a later milestone with auth.
        }
      },
    },
  })
}

// Cookie-free anon client for PUBLIC catalog reads (shows / genres / episodes /
// schedule / search). Unlike getServerClient it never touches cookies() /
// next/headers, so it is SAFE in build-time contexts such as
// generateStaticParams (which run without an HTTP request). Public data only —
// use getServerClient for auth / user-scoped operations.
export async function getPublicClient() {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured (public client).')
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

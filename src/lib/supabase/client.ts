// Browser-side Supabase client (Client Components).
// Safe to import even when env is unset — it only throws if you actually
// CALL getBrowserClient() without configuration, which the data layer avoids
// by checking isSupabaseConfigured() first.

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/lib/database.types'
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from './config'

export function getBrowserClient() {
  if (!isSupabaseConfigured()) {
    throw new Error(
      'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY, or rely on the seed fallback in src/lib/data.',
    )
  }
  return createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY)
}

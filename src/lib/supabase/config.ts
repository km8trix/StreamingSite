// Supabase configuration helpers.
// NOTE: reading process.env here is import-safe — it never throws when the
// vars are absent. Callers use isSupabaseConfigured() to branch to the
// offline seed fallback (see src/lib/data/shows.ts).

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

/**
 * True only when BOTH env vars are present and non-empty.
 * In Milestone 1 these are optional — when false, the data layer reads the
 * bundled seed.json so the app builds and renders without a live database.
 */
export function isSupabaseConfigured(): boolean {
  return SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0
}

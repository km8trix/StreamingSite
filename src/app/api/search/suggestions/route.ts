import { NextRequest } from 'next/server'
import { getSearchSuggestions } from '@/lib/data'
import { enforceRateLimit } from '@/lib/rate-limit'

// getSearchSuggestions reads the catalog (live Supabase when configured, seed
// otherwise) and depends on the per-request `q` param, so this route must never
// be statically cached.
export const dynamic = 'force-dynamic'

// Cap the raw query length before it reaches the data layer / driver. `q` is
// passed to supabase-js .ilike (parameterized — safe), but we still trim + cap.
const MAX_Q_LEN = 80
// Below this length we short-circuit to an empty result (no DB hit).
const MIN_Q_LEN = 2

/**
 * GET /api/search/suggestions?q=<query>
 *
 * Lightweight typeahead for the header search box. Returns:
 *   { suggestions: SearchSuggestion[] }
 * where SearchSuggestion = { slug, title, coverImage, year }.
 *
 * A blank or <2-char query returns { suggestions: [] } without touching the DB.
 */
export async function GET(request: NextRequest) {
  const limited = enforceRateLimit(request, {
    name: 'search-suggestions',
    limit: 60,
    windowMs: 60_000,
  })
  if (limited) return limited

  const raw = request.nextUrl.searchParams.get('q') ?? ''
  const q = raw.trim().slice(0, MAX_Q_LEN)

  if (q.length < MIN_Q_LEN) {
    return Response.json({ suggestions: [] })
  }

  const suggestions = await getSearchSuggestions(q)

  return Response.json(
    { suggestions },
    {
      // Short cache window — suggestions for a given prefix are stable enough
      // that a brief shared/CDN cache is fine; correctness comes first.
      headers: { 'Cache-Control': 'public, max-age=30' },
    },
  )
}

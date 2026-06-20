import { NextRequest } from 'next/server'
import { getRecommendedForYou } from '@/lib/data'
import { enforceRateLimit } from '@/lib/rate-limit'

// Personalized recommendations depend on the per-request watched-id list, so
// this must never be statically cached.
export const dynamic = 'force-dynamic'

// Bound how many watched ids we accept per request.
const MAX_IDS = 200

/**
 * POST /api/recommendations  { watched: string[] }  -> { shows: ShowSummary[] }
 *
 * The GUEST path for "Recommended For You": the browser holds the watch history
 * in localStorage, so it POSTs the watched show ids (in the BODY, not the URL —
 * watch history is mildly personal) and gets genre-overlap recommendations back.
 * An empty list yields the generic recommendations (same as a user with no
 * history). Signed-in users are served server-side and never hit this route.
 */
export async function POST(request: NextRequest) {
  const limited = await enforceRateLimit(request, {
    name: 'recommendations',
    limit: 30,
    windowMs: 60_000,
  })
  if (limited) return limited

  let watched: string[] = []
  try {
    const body: unknown = await request.json()
    const raw = (body as { watched?: unknown })?.watched
    if (Array.isArray(raw)) {
      watched = raw
        .filter((v): v is string => typeof v === 'string' && v.length > 0)
        .slice(0, MAX_IDS)
    }
  } catch {
    // Malformed/empty body -> treat as no history (generic recommendations).
  }

  const shows = await getRecommendedForYou(watched)

  return Response.json(
    { shows },
    { headers: { 'Cache-Control': 'private, no-store' } },
  )
}

import { redirect } from 'next/navigation'
import { getRandomShow } from '@/lib/data'

// getRandomShow() is non-deterministic, so this handler must never be cached
// or statically prerendered.
export const dynamic = 'force-dynamic'

/**
 * GET /random — pick a random show and redirect to its detail page.
 * Falls back to home if the catalog is empty.
 */
export async function GET() {
  const show = await getRandomShow()
  if (!show) redirect('/')
  redirect(`/shows/${show.slug}`)
}

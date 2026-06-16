import {
  getContinueWatching,
  getCurrentUser,
  getPopularShows,
  getRecentlyUpdatedShows,
  getRecommendedShows,
} from '@/lib/data'
import { FeaturedHero } from '@/components/FeaturedHero'
import { ShowCarousel } from '@/components/ShowCarousel'
import { ContinueWatchingRail } from '@/components/ContinueWatchingRail'
import { GuestProgressSync } from '@/components/GuestProgressSync'
import { AdSlot } from '@/components/AdSlot'

// The home-banner AdSlot calls getAdForPlacement (weighted-random, non-deterministic),
// so the page must render dynamically rather than be statically prerendered.
export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const [recentlyUpdated, popular, recommended, continueWatching, user] =
    await Promise.all([
      getRecentlyUpdatedShows(),
      getPopularShows(),
      getRecommendedShows(),
      getContinueWatching(),
      getCurrentUser(),
    ])

  const isSignedIn = Boolean(user)
  const featured = popular[0] ?? recommended[0] ?? recentlyUpdated[0] ?? null
  // Avoid repeating the featured title as the first popular card.
  const popularRail = featured
    ? popular.filter((s) => s.id !== featured.id)
    : popular

  const hasContent =
    recentlyUpdated.length + popular.length + recommended.length > 0

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      {/* Flush guest localStorage progress into the DB once after sign-in. */}
      <GuestProgressSync isSignedIn={isSignedIn} />

      {/* Continue Watching — pinned to the top for returning viewers; renders
          nothing when there's no progress (guests resolve it client-side). */}
      <ContinueWatchingRail items={continueWatching} isSignedIn={isSignedIn} />

      {featured && (
        <div className="mb-10">
          <FeaturedHero show={featured} />
        </div>
      )}

      {!hasContent ? (
        <p className="rounded-card border border-dashed border-border bg-card/40 px-4 py-16 text-center text-muted">
          No shows are available yet. Check back soon.
        </p>
      ) : (
        <div className="flex flex-col gap-10">
          <ShowCarousel
            title="Recently Updated"
            shows={recentlyUpdated}
            priorityFirst={!featured}
          />
          <ShowCarousel title="Popular" shows={popularRail} />

          {/* Non-invasive in-flow banner between rails — reserved height, no CLS. */}
          <AdSlot placementKey="home-banner" />

          <ShowCarousel title="Recommended For You" shows={recommended} />
        </div>
      )}
    </div>
  )
}

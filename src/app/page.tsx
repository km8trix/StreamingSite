import type { Metadata } from 'next'
import {
  getContinueWatching,
  getCurrentUser,
  getPopularShows,
  getRecentlyUpdatedShows,
  getRecommendedForYou,
  getRecommendedShows,
  getTopAnime,
  getWatchlist,
} from '@/lib/data'
import { FeaturedHero } from '@/components/FeaturedHero'
import { ShowCarousel } from '@/components/ShowCarousel'
import { ContinueWatchingRail } from '@/components/ContinueWatchingRail'
import { MyListRail } from '@/components/MyListRail'
import { RecommendedForYouRail } from '@/components/RecommendedForYouRail'
import { TopAnimeSection } from '@/components/TopAnimeSection'
import { GuestProgressSync } from '@/components/GuestProgressSync'
import { AdSlot } from '@/components/AdSlot'
import { JsonLd } from '@/components/JsonLd'
import { getMetadataBaseUrl } from '@/lib/metadata'

// The home-banner AdSlot calls getAdForPlacement (weighted-random, non-deterministic),
// so the page must render dynamically rather than be statically prerendered.
// Home is the canonical root URL.
export const metadata: Metadata = {
  alternates: { canonical: '/' },
}

// WebSite structured data with a SearchAction → enables Google's sitelinks
// search box. The search box submits to the catalog (/shows?q=…), which is where
// /search already redirects.
const siteOrigin = getMetadataBaseUrl().origin
const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Senpai',
  url: siteOrigin,
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${siteOrigin}/shows?q={search_term_string}`,
    },
    'query-input': 'required name=search_term_string',
  },
}

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const [
    recentlyUpdated,
    popular,
    recommended,
    continueWatching,
    watchlist,
    user,
    topDay,
    topWeek,
    topMonth,
  ] = await Promise.all([
    getRecentlyUpdatedShows(),
    getPopularShows(),
    getRecommendedShows(),
    getContinueWatching(),
    getWatchlist(),
    getCurrentUser(),
    getTopAnime('day'),
    getTopAnime('week'),
    getTopAnime('month'),
  ])

  const topWindows = { day: topDay, week: topWeek, month: topMonth }

  const isSignedIn = Boolean(user)

  // Personalized "Recommended For You" from watch history. Signed-in users are
  // resolved server-side off their Continue Watching shows; guests get the
  // generic list as a baseline here and the rail upgrades it client-side from
  // localStorage. getRecommendedForYou falls back to generic for empty history.
  const recommendedForYou = isSignedIn
    ? await getRecommendedForYou(continueWatching.map((i) => i.showId))
    : recommended

  const featured = popular[0] ?? recommended[0] ?? recentlyUpdated[0] ?? null
  // Avoid repeating the featured title as the first popular card.
  const popularRail = featured
    ? popular.filter((s) => s.id !== featured.id)
    : popular

  const hasContent =
    recentlyUpdated.length + popular.length + recommended.length > 0

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <JsonLd data={websiteJsonLd} />
      {/* Flush guest localStorage progress into the DB once after sign-in. */}
      <GuestProgressSync isSignedIn={isSignedIn} />

      {/* Featured show — pinned to the very top of the home page. */}
      {featured && (
        <div className="mb-10">
          <FeaturedHero show={featured} />
        </div>
      )}

      {/* Continue Watching — for returning viewers; renders nothing when there's
          no progress (guests resolve it client-side). */}
      <ContinueWatchingRail items={continueWatching} isSignedIn={isSignedIn} />

      {/* My List — the user's saved watchlist; renders nothing when empty
          (guests resolve it client-side from localStorage). */}
      <MyListRail items={watchlist} isSignedIn={isSignedIn} />

      {/* Personalized Recommended For You, directly under Continue Watching
          (replaces the old generic rail; falls back to generic with no history). */}
      <div className="mb-10">
        <RecommendedForYouRail
          shows={recommendedForYou}
          isSignedIn={isSignedIn}
        />
      </div>

      {!hasContent ? (
        <p className="rounded-card border border-dashed border-border bg-card/40 px-4 py-16 text-center text-muted">
          No shows are available yet. Check back soon.
        </p>
      ) : (
        <div className="flex flex-col gap-10">
          {/* Top Anime — ranked by real engagement, with a Day/Week/Month toggle. */}
          <TopAnimeSection windows={topWindows} />

          <ShowCarousel
            title="Recently Updated"
            shows={recentlyUpdated}
            priorityFirst={!featured}
          />
          <ShowCarousel title="Popular" shows={popularRail} />

          {/* Non-invasive in-flow banner between rails — reserved height, no CLS. */}
          <AdSlot placementKey="home-banner" />
        </div>
      )}
    </div>
  )
}

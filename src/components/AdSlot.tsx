import Image from 'next/image'
import Link from 'next/link'
import { getAdForPlacement } from '@/lib/data'
import { cn } from '@/lib/utils'
import { AdSlotTracker } from './AdSlotTracker'

/**
 * AdSlot — a NON-INVASIVE in-flow advertising slot.
 *
 * PRODUCT REQUIREMENT (explicit): non-invasive only. NO pop-ups, NO interstitials,
 * NO autoplay, NO layout shift. This renders an in-flow banner / native-card /
 * sidebar box that:
 *   - reserves a FIXED size up front (per placement), so the slot occupies the
 *     same space whether or not an ad is served → zero CLS;
 *   - shows a clearly-visible "Sponsored" disclosure label;
 *   - renders a single static image (next/image; placehold.co is allowlisted)
 *     wrapped in a normal <a> to the advertiser's target_url (opens nothing modal,
 *     plays nothing).
 *
 * The ad is FETCHED ON THE SERVER (this is an async Server Component) so the
 * markup — including the reserved box — ships in the initial HTML. A tiny client
 * child (AdSlotTracker) handles impression tracking (IntersectionObserver, lazy +
 * once) and click tracking, without ever blocking or altering navigation.
 *
 * getAdForPlacement is non-deterministic (weighted random), so a page using this
 * must render dynamically — do NOT call it during a static prerender. Every page
 * we wire (home/search/forum) already renders dynamically under the M3 auth-cookie
 * state, so this is satisfied.
 */

// Reserved, fixed dimensions per placement key. These match the seeded creative
// sizes and, crucially, fix the slot's footprint so there is no layout shift even
// when no ad is returned.
const SLOT_SIZES: Record<
  string,
  { width: number; height: number; label: string }
> = {
  // Short, full-width leaderboard between rails.
  'home-banner': { width: 970, height: 90, label: 'banner' },
  // Native card that sits inline with content (e.g. inside a rail/sidebar).
  'grid-native': { width: 300, height: 250, label: 'native card' },
  // Sidebar rectangle.
  sidebar: { width: 300, height: 250, label: 'sidebar' },
}

const DEFAULT_SIZE = { width: 300, height: 250, label: 'slot' }

export async function AdSlot({
  placementKey,
  className,
  'data-testid': testId = 'ad-slot',
}: {
  placementKey: string
  className?: string
  'data-testid'?: string
}) {
  const size = SLOT_SIZES[placementKey] ?? DEFAULT_SIZE
  const ad = await getAdForPlacement(placementKey)

  // Reserve the slot's footprint with an explicit max-width + aspect ratio so the
  // box is identical whether or not an ad is served (no CLS). The box scales down
  // on narrow viewports but never grows past the creative's intrinsic size.
  const reservedStyle: React.CSSProperties = {
    maxWidth: size.width,
    aspectRatio: `${size.width} / ${size.height}`,
  }

  // Empty slot: keep the reserved space (a subtle labelled placeholder) so the
  // surrounding layout never shifts when an ad later fills it.
  if (!ad) {
    return (
      <aside
        data-testid={testId}
        data-placement={placementKey}
        data-ad-empty="true"
        aria-hidden="true"
        className={cn('mx-auto w-full', className)}
        style={reservedStyle}
      />
    )
  }

  return (
    <aside
      data-testid={testId}
      data-placement={placementKey}
      aria-label="Advertisement"
      className={cn('mx-auto w-full', className)}
      style={reservedStyle}
    >
      <AdSlotTracker adId={ad.id}>
        <div className="relative h-full w-full overflow-hidden rounded-card border border-border bg-card">
          {/* Sponsored disclosure — clearly visible over the creative. */}
          <span
            data-testid="ad-sponsored-label"
            className="pointer-events-none absolute left-1.5 top-1.5 z-10 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/90 ring-1 ring-white/15 backdrop-blur-sm"
          >
            Sponsored
          </span>

          <Link
            href={ad.targetUrl}
            data-testid="ad-slot-link"
            // Same-origin house ads today; rel guards in case a future creative
            // points off-site. No target="_blank" → no new-tab popup behavior.
            rel="nofollow sponsored"
            className="block h-full w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-background motion-safe:transition-opacity motion-safe:hover:opacity-95"
          >
            <Image
              src={ad.imageUrl}
              alt={ad.altText ?? ad.name ?? 'Sponsored advertisement'}
              fill
              // The creative is a fixed banner/rectangle; serve it at slot width.
              sizes={`${size.width}px`}
              // Ad creatives are externally-hosted and may be SVG (e.g. the
              // placehold.co house ads return image/svg+xml). next/image rejects
              // SVG through the optimizer unless dangerouslyAllowSVG is enabled
              // site-wide — which we deliberately avoid for security. Serving ad
              // creatives unoptimized renders them without weakening the global
              // image policy; they are small fixed-size banners.
              unoptimized
              className="object-contain"
            />
          </Link>
        </div>
      </AdSlotTracker>
    </aside>
  )
}

import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Layers } from 'lucide-react'
import { getCurrentUser, getShowBySlug, getWhereToWatch, isInWatchlist } from '@/lib/data'
import seed from '@/lib/data/seed.json'
import { CommentsSection } from '@/components/CommentsSection'
import { EpisodeList } from '@/components/EpisodeList'
import { StatusBadge } from '@/components/StatusBadge'
import { SubDubBadges } from '@/components/SubDubBadges'
import { WatchSection } from '@/components/WatchSection'
import { WatchlistButton } from '@/components/WatchlistButton'
import { ShowViewTracker } from '@/components/ShowViewTracker'

type Params = { slug: string }

// Prerender every show in the bundled seed at build time, but allow slugs that
// only exist in the live DB to render ON DEMAND too (dynamicParams = true).
//
// We intentionally do NOT query the live database here: build-time path
// enumeration must never depend on the cloud DB being reachable/seeded/migrated
// (a thrown query here crashes `next build` → "Collecting page data" on Vercel).
// Deriving params straight from the bundled seed.json keeps the build fully
// self-contained; getShowBySlug() below still calls notFound() for any slug that
// resolves to no show, so unknown slugs correctly 404 at request time.
export const dynamicParams = true

// Prerender every seed show at build time (no live DB query).
export async function generateStaticParams(): Promise<Params[]> {
  try {
    const shows = (seed.shows ?? []) as { slug: string }[]
    return shows.map((s) => ({ slug: s.slug }))
  } catch {
    // Final safety net: never let path enumeration crash the build.
    return []
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>
}): Promise<Metadata> {
  const { slug } = await params
  const show = await getShowBySlug(slug)
  if (!show) return { title: 'Show not found' }

  const description = show.synopsis
    ? show.synopsis.slice(0, 160).trim()
    : `Watch ${show.title} — ${show.subEpisodes} subbed episodes.`

  return {
    title: show.title,
    description,
    openGraph: {
      title: show.title,
      description,
      images: [{ url: show.coverImage }],
    },
  }
}

export default async function ShowDetailPage({
  params,
}: {
  params: Promise<Params>
}) {
  const { slug } = await params
  const show = await getShowBySlug(slug)
  if (!show) notFound()

  // Legal "where to watch" providers (AniList) for WatchSection, plus the
  // viewer's session + whether they've saved this show (seeds the Save button).
  const [whereToWatch, user, savedInList] = await Promise.all([
    getWhereToWatch(show.title),
    getCurrentUser(),
    isInWatchlist(show.id),
  ])

  return (
    <article className="pb-8">
      {/* Records a view event (guests + signed-in) for the Top Anime rankings. */}
      <ShowViewTracker showId={show.id} />
      {/* ---- HERO (tolerates null bannerImage) ---------------------------- */}
      <header className="relative isolate overflow-hidden border-b border-border">
        <div className="absolute inset-0 -z-10">
          {/* No wide banner in the seed: fall back to the cover, blurred. */}
          <Image
            src={show.bannerImage ?? show.coverImage}
            alt=""
            fill
            priority
            sizes="100vw"
            className="scale-110 object-cover object-top opacity-30 blur-2xl"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/85 to-background/50" />
        </div>

        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10 md:flex-row md:gap-8 lg:px-8">
          <div className="relative aspect-[2/3] w-36 shrink-0 overflow-hidden rounded-xl border border-border shadow-2xl sm:w-44 lg:w-52">
            <Image
              src={show.coverImage}
              alt={`${show.title} cover art`}
              fill
              priority
              sizes="(min-width: 1024px) 208px, (min-width: 640px) 176px, 144px"
              className="object-cover"
            />
          </div>

          <div className="flex flex-col gap-4">
            <nav
              aria-label="Breadcrumb"
              className="flex items-center text-xs text-subtle"
            >
              <Link href="/" className="hover:text-foreground">
                Home
              </Link>
              <span className="mx-1.5" aria-hidden>
                /
              </span>
              <Link href="/shows" className="hover:text-foreground">
                Browse
              </Link>
              <span className="mx-1.5" aria-hidden>
                /
              </span>
              <span
                className="max-w-[55vw] truncate text-muted sm:max-w-xs"
                aria-current="page"
              >
                {show.title}
              </span>
            </nav>

            <h1 className="text-balance text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              {show.title}
            </h1>

            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={show.status} />
              {show.year && (
                <span className="rounded-full border border-border bg-surface/80 px-2.5 py-1 text-xs font-medium text-muted">
                  {show.year}
                </span>
              )}
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface/80 px-2.5 py-1 text-xs font-medium text-muted">
                <Layers className="size-3" aria-hidden />
                {show.episodes.length}{' '}
                {show.episodes.length === 1 ? 'entry' : 'episodes'}
              </span>
            </div>

            <SubDubBadges
              subEpisodes={show.subEpisodes}
              dubEpisodes={show.dubEpisodes}
              size="md"
            />

            {/* Save to "My List" (works for guests via localStorage). */}
            <div>
              <WatchlistButton
                show={{
                  id: show.id,
                  slug: show.slug,
                  title: show.title,
                  coverImage: show.coverImage,
                  year: show.year,
                }}
                isSignedIn={Boolean(user)}
                initialSaved={savedInList}
              />
            </div>

            {show.genres.length > 0 && (
              <ul className="flex flex-wrap gap-2" aria-label="Genres">
                {show.genres.map((g) => (
                  <li key={g.id}>
                    <Link
                      href={`/genre/${g.slug}`}
                      className="inline-block rounded-full bg-card px-3 py-1 text-xs font-medium text-muted ring-1 ring-inset ring-border transition-colors hover:text-accent-strong hover:ring-border-strong"
                    >
                      {g.name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </header>

      {/* ---- BODY -------------------------------------------------------- */}
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_22rem] lg:px-8">
        <div className="flex flex-col gap-8">
          {/* Discovery watch hub: an official embed when a provider is legally
              embeddable, plus "where to watch" out-links. Senpai hosts no video. */}
          <WatchSection title={show.title} links={whereToWatch} />

          {show.synopsis && (
            <section aria-labelledby="synopsis-heading">
              <h2
                id="synopsis-heading"
                className="mb-2 text-lg font-bold text-foreground"
              >
                Synopsis
              </h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-muted">
                {show.synopsis}
              </p>
            </section>
          )}
        </div>

        <section aria-labelledby="episodes-heading" className="lg:max-w-md">
          <div className="mb-3 flex items-baseline justify-between">
            <h2
              id="episodes-heading"
              className="text-lg font-bold text-foreground"
            >
              Episodes
            </h2>
            <span className="text-xs text-subtle">
              {show.episodes.length} total
            </span>
          </div>
          <EpisodeList episodes={show.episodes} />
        </section>
      </div>

      {/* ---- COMMENTS ---------------------------------------------------- */}
      <div className="mx-auto max-w-7xl px-4 pb-4 sm:px-6 lg:px-8">
        <div className="border-t border-border pt-8 lg:max-w-3xl">
          <CommentsSection showId={show.id} />
        </div>
      </div>
    </article>
  )
}

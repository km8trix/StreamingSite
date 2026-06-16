import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Layers } from 'lucide-react'
import { getAllShows, getShowBySlug } from '@/lib/data'
import { CommentsSection } from '@/components/CommentsSection'
import { EpisodeList } from '@/components/EpisodeList'
import { PlayerPlaceholder } from '@/components/PlayerPlaceholder'
import { StatusBadge } from '@/components/StatusBadge'
import { SubDubBadges } from '@/components/SubDubBadges'

type Params = { slug: string }

// The catalog is fully known at build time, so prerender every show and let any
// unknown slug fall through to Next's real 404 handler (true 404 status) rather
// than being rendered on demand. notFound() below still guards the live-Supabase
// path where a slug could 404 at request time.
//
// NOTE (M3): this only keeps producing a hard 404 because the auth/session read
// in the header is isolated behind a <Suspense> boundary (see SiteHeader). That
// keeps this route statically prerenderable; without it, the cookie read would
// taint the tree dynamic and an unknown slug would render the not-found UI with
// a 200 status instead of 404.
export const dynamicParams = false

// Prerender every seed show at build time.
export async function generateStaticParams(): Promise<Params[]> {
  const shows = await getAllShows()
  return shows.map((s) => ({ slug: s.slug }))
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

  return (
    <article className="pb-8">
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
            <nav aria-label="Breadcrumb" className="text-xs text-subtle">
              <Link href="/" className="hover:text-foreground">
                Home
              </Link>
              <span className="mx-1.5" aria-hidden>
                /
              </span>
              <Link href="/shows" className="hover:text-foreground">
                Browse
              </Link>
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

            {show.genres.length > 0 && (
              <ul className="flex flex-wrap gap-2" aria-label="Genres">
                {show.genres.map((g) => (
                  <li
                    key={g.id}
                    className="rounded-full bg-card px-3 py-1 text-xs font-medium text-muted ring-1 ring-inset ring-border"
                  >
                    {g.name}
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
          <PlayerPlaceholder title={show.title} />

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

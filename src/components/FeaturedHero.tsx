import Image from 'next/image'
import Link from 'next/link'
import { Info, Play, Sparkles } from 'lucide-react'
import type { ShowSummary } from '@/lib/data'
import { RandomizeButton } from './RandomizeButton'
import { StatusBadge } from './StatusBadge'
import { SubDubBadges } from './SubDubBadges'

/**
 * FeaturedHero — the home billboard. The seed has only portrait cover art (no
 * wide banner), so we build a cinematic key-art hero from it: a blurred full-
 * bleed backdrop, the sharp cover bled in from the right and faded into the
 * page, and the title + actions anchored bottom-left over a legibility scrim.
 */
export function FeaturedHero({ show }: { show: ShowSummary }) {
  return (
    <section
      className="relative isolate flex min-h-[24rem] flex-col justify-end overflow-hidden rounded-card border border-border bg-surface sm:min-h-[28rem] lg:min-h-[32rem]"
      aria-labelledby="featured-title"
      data-testid="featured-hero"
    >
      {/* ---- backdrop ---------------------------------------------------- */}
      <div className="absolute inset-0 -z-10">
        {/* blurred full-bleed fill */}
        <Image
          src={show.coverImage}
          alt=""
          fill
          priority
          sizes="100vw"
          className="scale-110 object-cover object-top opacity-30 blur-2xl"
        />

        {/* sharp key-art bled in from the right, faded into the page */}
        <div className="absolute inset-y-0 right-0 w-[72%] sm:w-[58%] lg:w-1/2">
          <Image
            src={show.coverImage}
            alt=""
            fill
            sizes="(min-width: 1024px) 50vw, (min-width: 640px) 58vw, 72vw"
            className="object-cover object-top"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/15 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent" />
        </div>

        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/25 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/40 to-transparent" />
        <div className="absolute -left-24 bottom-[-4rem] size-72 rounded-full bg-accent/15 blur-3xl" />
      </div>

      {/* ---- content ----------------------------------------------------- */}
      <div className="relative max-w-xl p-6 sm:p-8 lg:p-12">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-accent-strong ring-1 ring-inset ring-accent/30">
            <Sparkles className="size-3.5" aria-hidden />
            Featured
          </span>
          <StatusBadge status={show.status} />
          {show.year && (
            <span className="text-xs font-medium text-muted">{show.year}</span>
          )}
        </div>

        <h1
          id="featured-title"
          className="text-balance text-4xl font-extrabold leading-[1.05] tracking-tight text-foreground [text-shadow:0_2px_24px_rgba(0,0,0,0.5)] sm:text-5xl lg:text-6xl"
        >
          {show.title}
        </h1>

        <div className="mt-5">
          <SubDubBadges
            subEpisodes={show.subEpisodes}
            dubEpisodes={show.dubEpisodes}
            size="md"
          />
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            href={`/shows/${show.slug}`}
            className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground transition-all hover:bg-accent-strong hover:shadow-[0_10px_30px_-8px_rgba(139,92,246,0.8)]"
          >
            <Play className="size-4 fill-current" aria-hidden />
            Watch now
          </Link>
          <Link
            href={`/shows/${show.slug}`}
            className="inline-flex items-center gap-2 rounded-full border border-border-strong bg-surface/60 px-6 py-3 text-sm font-semibold text-foreground backdrop-blur-sm transition-colors hover:border-accent/60 hover:text-accent-strong"
          >
            <Info className="size-4" aria-hidden />
            Details
          </Link>
          <RandomizeButton variant="outline" label="Surprise me" />
        </div>
      </div>
    </section>
  )
}

import Image from 'next/image'
import Link from 'next/link'
import { Info, Play } from 'lucide-react'
import type { ShowSummary } from '@/lib/data'
import { RandomizeButton } from './RandomizeButton'
import { StatusBadge } from './StatusBadge'
import { SubDubBadges } from './SubDubBadges'

/**
 * FeaturedHero — home spotlight built from the top popular show. The seed has
 * no wide banner, so we use the portrait cover as a blurred, gradient-masked
 * backdrop plus a sharp cover thumbnail — no dependence on bannerImage.
 */
export function FeaturedHero({ show }: { show: ShowSummary }) {
  return (
    <section
      className="relative isolate overflow-hidden rounded-card border border-border bg-surface"
      aria-labelledby="featured-title"
      data-testid="featured-hero"
    >
      {/* blurred backdrop from the portrait cover */}
      <div className="absolute inset-0 -z-10">
        <Image
          src={show.coverImage}
          alt=""
          fill
          priority
          sizes="100vw"
          className="scale-110 object-cover object-top opacity-40 blur-2xl"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/90 to-background/40" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
      </div>

      <div className="flex flex-col items-start gap-6 p-6 sm:p-8 md:flex-row md:items-center md:gap-8 md:p-10">
        {/* sharp cover */}
        <Link
          href={`/shows/${show.slug}`}
          className="group relative hidden aspect-[2/3] w-40 shrink-0 overflow-hidden rounded-xl border border-border shadow-2xl sm:block lg:w-48"
        >
          <Image
            src={show.coverImage}
            alt={`${show.title} cover art`}
            fill
            sizes="(min-width: 1024px) 192px, 160px"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </Link>

        <div className="flex max-w-2xl flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-accent-strong">
              Featured
            </span>
            <StatusBadge status={show.status} />
            {show.year && (
              <span className="text-xs text-muted">{show.year}</span>
            )}
          </div>

          <h1
            id="featured-title"
            className="text-balance text-3xl font-extrabold leading-tight tracking-tight text-foreground sm:text-4xl lg:text-5xl"
          >
            {show.title}
          </h1>

          <SubDubBadges
            subEpisodes={show.subEpisodes}
            dubEpisodes={show.dubEpisodes}
            size="md"
          />

          <div className="mt-1 flex flex-wrap items-center gap-3">
            <Link
              href={`/shows/${show.slug}`}
              className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground transition-all hover:bg-accent-strong hover:shadow-[0_8px_24px_-8px_rgba(139,92,246,0.7)]"
            >
              <Play className="size-4 fill-current" aria-hidden />
              Watch now
            </Link>
            <Link
              href={`/shows/${show.slug}`}
              className="inline-flex items-center gap-2 rounded-full border border-border-strong bg-surface/60 px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-accent/60 hover:text-accent-strong"
            >
              <Info className="size-4" aria-hidden />
              Details
            </Link>
            <RandomizeButton variant="outline" label="Surprise me" />
          </div>
        </div>
      </div>
    </section>
  )
}

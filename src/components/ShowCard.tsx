import Image from 'next/image'
import Link from 'next/link'
import type { ShowSummary } from '@/lib/data'
import { cn } from '@/lib/utils'
import { SubDubBadges } from './SubDubBadges'

/**
 * ShowCard — portrait cover art (next/image, ~2:3), title, and SUB/DUB badges.
 * Server component (no interactivity beyond the link + CSS hover).
 *
 * `priority` should be set true for the first few above-the-fold cards to avoid
 * LCP penalties; `sizes` is provided so next/image serves right-sized images.
 */
export function ShowCard({
  show,
  className,
  priority = false,
  sizes = '(min-width: 1280px) 16vw, (min-width: 1024px) 22vw, (min-width: 640px) 30vw, 45vw',
}: {
  show: ShowSummary
  className?: string
  priority?: boolean
  sizes?: string
}) {
  return (
    <Link
      href={`/shows/${show.slug}`}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-card border border-border bg-card transition-all duration-200',
        'hover:-translate-y-1 hover:border-accent/60 hover:bg-card-hover hover:shadow-[0_12px_40px_-12px_rgba(139,92,246,0.45)]',
        'focus-visible:-translate-y-1 focus-visible:border-accent',
        className,
      )}
      data-testid="show-card"
      data-slug={show.slug}
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-surface">
        <Image
          src={show.coverImage}
          alt={`${show.title} cover art`}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
        {/* bottom gradient so badges stay legible over busy art */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
        <div className="absolute inset-x-2 bottom-2">
          <SubDubBadges
            subEpisodes={show.subEpisodes}
            dubEpisodes={show.dubEpisodes}
          />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3
          className="line-clamp-2 text-sm font-semibold leading-snug text-foreground transition-colors group-hover:text-accent-strong"
          title={show.title}
        >
          {show.title}
        </h3>
        <p className="mt-auto text-xs text-subtle">
          {show.year ?? '—'}
        </p>
      </div>
    </Link>
  )
}

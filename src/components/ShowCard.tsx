import Image from 'next/image'
import Link from 'next/link'
import { Play } from 'lucide-react'
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
        'group relative flex h-full flex-col overflow-hidden rounded-card border border-border bg-card transition-all duration-200',
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
        {/* hover/focus: dim the art and reveal a play affordance (decorative —
            the whole card is the link) */}
        <div className="pointer-events-none absolute inset-0 bg-black/0 transition-colors duration-200 group-hover:bg-black/30 group-focus-visible:bg-black/30" />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
          <span className="grid size-12 place-items-center rounded-full bg-accent/90 text-accent-foreground shadow-[0_8px_24px_-6px_rgba(139,92,246,0.8)] ring-1 ring-inset ring-white/25">
            <Play className="size-5 fill-current" aria-hidden />
          </span>
        </div>
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
          className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-snug text-foreground transition-colors group-hover:text-accent-strong"
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

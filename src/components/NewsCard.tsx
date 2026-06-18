import { ExternalLink } from 'lucide-react'
import type { NewsArticle } from '@/lib/data'
import { cn } from '@/lib/utils'

/**
 * NewsCard — one curated headline. The whole card is an external link to the
 * article's original source (new tab, rel="noopener noreferrer"); we never host
 * the full article. `featured` renders a larger lead card for the newest item.
 *
 * Server component (no client state): the published date is formatted on the
 * server, so there's no hydration concern.
 */

// Category → accent classes for the chip. Unknown categories fall back to the
// app accent so a new category never renders unstyled.
const CATEGORY_STYLES: Record<string, string> = {
  'New Anime': 'bg-violet-500/15 text-violet-300 ring-violet-500/30',
  Industry: 'bg-sky-500/15 text-sky-300 ring-sky-500/30',
  Manga: 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
  'Box Office': 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
  Events: 'bg-pink-500/15 text-pink-300 ring-pink-500/30',
}
const CATEGORY_FALLBACK = 'bg-accent/15 text-accent-strong ring-accent/30'

function formatPublished(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(d)
}

export function NewsCard({
  article,
  featured = false,
}: {
  article: NewsArticle
  featured?: boolean
}) {
  const chip = article.category
    ? (CATEGORY_STYLES[article.category] ?? CATEGORY_FALLBACK)
    : null
  const published = formatPublished(article.publishedAt)

  return (
    <a
      href={article.sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="news-card"
      data-featured={featured ? 'true' : 'false'}
      className={cn(
        'group flex h-full flex-col rounded-card border border-border bg-card/40 p-5 transition-colors',
        'hover:border-border-strong hover:bg-card-hover',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        featured && 'sm:p-6',
      )}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {chip && (
          <span
            data-testid="news-category"
            className={cn(
              'rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ring-1 ring-inset',
              chip,
            )}
          >
            {article.category}
          </span>
        )}
        {published && (
          <span className="text-xs tabular-nums text-muted">{published}</span>
        )}
      </div>

      <h2
        className={cn(
          'font-extrabold leading-snug tracking-tight text-foreground transition-colors group-hover:text-accent-strong',
          featured ? 'text-xl sm:text-2xl' : 'line-clamp-2 text-base',
        )}
      >
        {article.title}
      </h2>

      {article.summary && (
        <p
          className={cn(
            'mt-2 text-sm leading-relaxed text-muted',
            featured ? 'line-clamp-3' : 'line-clamp-2',
          )}
        >
          {article.summary}
        </p>
      )}

      <div className="mt-4 flex items-center gap-1.5 pt-1 text-xs font-medium text-muted">
        {article.source && <span className="truncate">{article.source}</span>}
        <ExternalLink
          className="size-3.5 shrink-0 text-muted transition-colors group-hover:text-accent-strong"
          aria-hidden
        />
        <span className="sr-only">(opens in a new tab)</span>
      </div>
    </a>
  )
}

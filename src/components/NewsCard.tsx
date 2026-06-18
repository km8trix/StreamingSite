import Image from 'next/image'
import { ExternalLink, Newspaper } from 'lucide-react'
import type { NewsArticle } from '@/lib/data'

/**
 * NewsCard — one headline as a LiveChart-style row: thumbnail on the left, then
 * the title, a short excerpt, and a meta line (source domain · date). The whole
 * row is an external link to the original article (new tab, rel="noopener
 * noreferrer"); we never host the article.
 *
 * Server component (no client state): the date is formatted on the server, so
 * there's no hydration concern.
 */

function formatPublished(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(d)
}

function sourceDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

export function NewsCard({ article }: { article: NewsArticle }) {
  const published = formatPublished(article.publishedAt)
  const domain = sourceDomain(article.sourceUrl)

  return (
    <a
      href={article.sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="news-card"
      className="group flex gap-4 rounded-card border border-border bg-card/40 p-3 transition-colors hover:border-border-strong hover:bg-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <div
        data-testid="news-thumb"
        className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-md bg-surface ring-1 ring-border sm:w-44"
      >
        {article.imageUrl ? (
          <Image
            src={article.imageUrl}
            alt=""
            fill
            sizes="(min-width: 640px) 176px, 112px"
            className="object-cover"
          />
        ) : (
          <div className="grid h-full w-full place-items-center bg-gradient-to-br from-accent/15 to-surface text-muted">
            <Newspaper className="size-6" aria-hidden />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        {article.category && (
          <span
            data-testid="news-tag"
            className="mb-1 inline-block rounded-full bg-accent/15 px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide text-accent-strong"
          >
            {article.category}
          </span>
        )}
        <h2 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground transition-colors group-hover:text-accent-strong sm:text-base">
          {article.title}
        </h2>
        {article.summary && (
          <p className="mt-1 line-clamp-2 text-xs text-muted sm:text-sm">
            {article.summary}
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
          {domain && (
            <span data-testid="news-source" className="font-medium">
              {domain}
            </span>
          )}
          {domain && published && <span aria-hidden>·</span>}
          {published && <span className="tabular-nums">{published}</span>}
          <ExternalLink
            className="size-3.5 text-muted transition-colors group-hover:text-accent-strong"
            aria-hidden
          />
          <span className="sr-only">(opens in a new tab)</span>
        </div>
      </div>
    </a>
  )
}

import { ExternalLink, Play } from 'lucide-react'
import type { StreamingLink } from '@/lib/data'

/**
 * WhereToWatch — official, legal places to stream a title (from AniList).
 * Each provider is an external link (new tab, rel="noopener noreferrer"); Senpai
 * links OUT to licensed services and never hosts or proxies video.
 *
 * Server component (no client state).
 */
export function WhereToWatch({
  links,
  title,
}: {
  links: StreamingLink[]
  title: string
}) {
  return (
    <section
      aria-labelledby="where-to-watch-heading"
      data-testid="where-to-watch"
      className="rounded-card border border-border bg-card/30 p-4 sm:p-5"
    >
      <h2
        id="where-to-watch-heading"
        className="text-base font-bold tracking-tight text-foreground sm:text-lg"
      >
        Where to watch
      </h2>

      {links.length === 0 ? (
        <p
          data-testid="where-to-watch-empty"
          className="mt-2 text-sm text-muted"
        >
          No official streaming info yet. Check back soon.
        </p>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-2">
          {links.map((link) => (
            <li key={link.site}>
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="where-to-watch-link"
                className="group inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3.5 py-2 text-sm font-semibold text-foreground transition-colors hover:border-accent/50 hover:bg-card-hover hover:text-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <Play className="size-3.5 fill-current text-accent-strong" aria-hidden />
                {link.site}
                <ExternalLink
                  className="size-3.5 text-muted transition-colors group-hover:text-accent-strong"
                  aria-hidden
                />
                <span className="sr-only">
                  — watch {title} on {link.site} (opens in a new tab)
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-xs text-subtle">
        Links go to official, licensed providers. Senpai doesn&apos;t host video.
      </p>
    </section>
  )
}

import Link from 'next/link'
import { Home, Compass } from 'lucide-react'

/**
 * Root not-found — renders inside the shared layout (header/footer) for any
 * unmatched route or a top-level notFound(). Mirrors the show-detail 404 so the
 * 404 experience is consistent across the site instead of falling back to Next's
 * default unstyled page.
 */
export default function NotFound() {
  return (
    <div
      data-testid="not-found"
      className="mx-auto flex max-w-xl flex-col items-center gap-5 px-4 py-24 text-center"
    >
      <span className="text-6xl font-extrabold tracking-tight text-accent-strong">
        404
      </span>
      <h1 className="text-2xl font-bold text-foreground">
        This page doesn&apos;t exist
      </h1>
      <p className="text-muted">
        The link may be broken, or the page may have moved.
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent-strong"
        >
          <Home className="size-4" aria-hidden />
          Go home
        </Link>
        <Link
          href="/shows"
          className="inline-flex items-center gap-2 rounded-full border border-border-strong bg-surface px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-accent/60 hover:text-accent-strong"
        >
          <Compass className="size-4" aria-hidden />
          Browse shows
        </Link>
      </div>
    </div>
  )
}

import Link from 'next/link'
import { Logo } from './Logo'

/**
 * SiteFooter — lightweight footer with wordmark and a non-functional/demo
 * disclaimer. Links here point only at in-scope routes.
 */
export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border bg-surface/60">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
        <div className="flex flex-col gap-2">
          <Logo />
          <p className="max-w-sm text-sm text-muted">
            A demo anime catalog. Cover art and metadata are sourced from
            MyAnimeList for illustration purposes. No real streaming.
          </p>
        </div>

        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <Link href="/" className="text-muted hover:text-foreground">
            Home
          </Link>
          <Link href="/shows" className="text-muted hover:text-foreground">
            Browse
          </Link>
          <Link href="/random" className="text-muted hover:text-foreground">
            Surprise me
          </Link>
          <Link href="/terms" className="text-muted hover:text-foreground">
            Terms
          </Link>
          <Link href="/privacy" className="text-muted hover:text-foreground">
            Privacy
          </Link>
          <Link href="/dmca" className="text-muted hover:text-foreground">
            DMCA
          </Link>
        </nav>
      </div>

      <div className="border-t border-border">
        <p className="mx-auto max-w-7xl px-4 py-4 text-xs text-subtle sm:px-6 lg:px-8">
          © {new Date().getFullYear()} Senpai. A non-commercial demo — not
          affiliated with any streaming service.
        </p>
      </div>
    </footer>
  )
}

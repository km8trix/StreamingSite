import Link from 'next/link'
import { Home, Shuffle } from 'lucide-react'

export default function ShowNotFound() {
  return (
    <div
      data-testid="show-not-found"
      className="mx-auto flex max-w-xl flex-col items-center gap-5 px-4 py-24 text-center"
    >
      <span className="text-6xl font-extrabold tracking-tight text-accent-strong">
        404
      </span>
      <h1 className="text-2xl font-bold text-foreground">
        We couldn&apos;t find that show
      </h1>
      <p className="text-muted">
        It may have been removed, or the link is incorrect.
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
          href="/random"
          className="inline-flex items-center gap-2 rounded-full border border-border-strong bg-surface px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-accent/60 hover:text-accent-strong"
        >
          <Shuffle className="size-4" aria-hidden />
          Random show
        </Link>
      </div>
    </div>
  )
}

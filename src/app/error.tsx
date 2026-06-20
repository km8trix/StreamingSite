'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Home, RotateCcw } from 'lucide-react'
import * as Sentry from '@sentry/nextjs'

/**
 * Root error boundary — catches uncaught errors thrown while rendering a route
 * segment and renders a styled, in-shell recovery screen (instead of Next's
 * default error page). Must be a Client Component and expose `reset()` to retry
 * the failed render. The root layout itself is not covered here (that needs
 * global-error.tsx); this covers every page under the shared layout.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Report to Sentry (a no-op until a DSN is set) and surface to console /
    // server logs; `digest` correlates a production error to its server stack.
    Sentry.captureException(error)
    console.error(error)
  }, [error])

  return (
    <div
      data-testid="app-error"
      className="mx-auto flex max-w-xl flex-col items-center gap-5 px-4 py-24 text-center"
    >
      <span className="text-5xl font-extrabold tracking-tight text-accent-strong">
        Something went wrong
      </span>
      <h1 className="text-xl font-bold text-foreground">
        That didn&apos;t load as expected
      </h1>
      <p className="text-muted">
        An unexpected error occurred. You can try again, or head back home.
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent-strong"
        >
          <RotateCcw className="size-4" aria-hidden />
          Try again
        </button>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full border border-border-strong bg-surface px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-accent/60 hover:text-accent-strong"
        >
          <Home className="size-4" aria-hidden />
          Go home
        </Link>
      </div>
    </div>
  )
}

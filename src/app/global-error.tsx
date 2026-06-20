'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

/**
 * Global error boundary — catches errors thrown in the ROOT layout itself, which
 * src/app/error.tsx cannot (it only covers pages under the shared layout). It
 * replaces the whole document, so it renders its own <html>/<body>. Reports to
 * Sentry, then shows a minimal, dependency-free recovery screen (inline styles
 * because the layout — and thus global CSS — failed to render).
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string }
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="en">
      <body
        style={{
          minHeight: '100vh',
          margin: 0,
          display: 'grid',
          placeItems: 'center',
          fontFamily: 'system-ui, sans-serif',
          background: '#0a0a0a',
          color: '#fafafa',
        }}
      >
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
            Something went wrong
          </h1>
          <p style={{ color: '#a1a1aa', marginTop: '0.5rem' }}>
            An unexpected error occurred. Please reload the page.
          </p>
          {/* global-error replaces the whole document after the root layout
              failed, so next/link's router context isn't reliable here — a plain
              full-document navigation is the correct recovery. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/"
            style={{
              display: 'inline-block',
              marginTop: '1.25rem',
              padding: '0.625rem 1.25rem',
              borderRadius: '9999px',
              background: '#fafafa',
              color: '#0a0a0a',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Go home
          </a>
        </div>
      </body>
    </html>
  )
}

'use client'

import { useSyncExternalStore } from 'react'
import Link from 'next/link'
import { Analytics } from '@vercel/analytics/next'
import {
  getConsentSnapshot,
  getConsentServerSnapshot,
  subscribeConsent,
  setConsent,
} from '@/lib/consent-store'

// Cookie-consent gate. Vercel Analytics is the only non-essential tracker we
// load, so it mounts ONLY after the visitor accepts. Essential cookies (Supabase
// auth/session) are strictly necessary and are not gated. The choice persists in
// localStorage; the banner shows until a choice is made.
export function CookieConsent() {
  const consent = useSyncExternalStore(
    subscribeConsent,
    getConsentSnapshot,
    getConsentServerSnapshot,
  )

  return (
    <>
      {consent === 'accepted' && <Analytics />}
      {consent === 'unset' && (
        <section
          aria-label="Cookie consent"
          className="fixed inset-x-0 bottom-0 z-[90] border-t border-border bg-surface/95 px-4 py-4 backdrop-blur sm:px-6"
        >
          <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted">
              We use essential cookies to keep you signed in, and optional
              analytics cookies to understand usage. See our{' '}
              <Link href="/privacy" className="text-accent-strong underline">
                Privacy Policy
              </Link>
              .
            </p>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => setConsent('declined')}
                className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-card"
              >
                Decline
              </button>
              <button
                type="button"
                onClick={() => setConsent('accepted')}
                className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90"
              >
                Accept
              </button>
            </div>
          </div>
        </section>
      )}
    </>
  )
}

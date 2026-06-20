// metadata.ts — the canonical public origin for Next Metadata (`metadataBase`).
//
// metadataBase resolves the absolute URLs Next emits for Open Graph / canonical
// tags, so it must be the STABLE public production origin — not a per-request
// host and not a preview deployment. Unlike getSiteOrigin() (which derives the
// OAuth return host from the live request on purpose), this is a build/render
// constant: a canonical URL should always point at production.
//
// Resolution order:
//   1. VERCEL_PROJECT_PRODUCTION_URL — Vercel's stable production domain, set
//      automatically on every deployment (preview builds still get the PROD url).
//   2. NEXT_PUBLIC_SITE_URL — explicit override for a custom domain / local.
//   3. a hardcoded production fallback (only hit when neither env var is set,
//      e.g. a bare `next build` locally — harmless for OG during local dev).

const FALLBACK = 'https://streaming-site-one.vercel.app'

function envUrl(value: string | undefined): string | null {
  const s = value?.trim()
  if (!s) return null
  return s.startsWith('http://') || s.startsWith('https://') ? s : `https://${s}`
}

/** The absolute origin to use as Next's `metadataBase`. Never throws. */
export function getMetadataBaseUrl(): URL {
  const candidate =
    envUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL) ??
    envUrl(process.env.NEXT_PUBLIC_SITE_URL) ??
    FALLBACK
  try {
    return new URL(candidate)
  } catch {
    return new URL(FALLBACK)
  }
}

/**
 * AdSenseScript — the Google AdSense loader. Renders the exact async script tag
 * AdSense requires; with it present, Google auto-places ads (formats are tuned in
 * the AdSense dashboard — turn OFF Vignette/Anchor/Overlay there to honour the
 * app's non-invasive / no-CLS ad policy).
 *
 * A plain <script async> (NOT next/script): React hoists it into <head> in the
 * server-rendered HTML, so AdSense's verifier finds the tag on first load. (Both
 * next/script strategies failed that: afterInteractive injects client-side after
 * hydration, and beforeInteractive didn't emit when wrapped in this component.)
 *
 * Gated on the publisher client id (NEXT_PUBLIC_ADSENSE_CLIENT, e.g.
 * "ca-pub-1191181818524233"), so it's a no-op when unset (dev/CI/e2e). The id is
 * public. NEXT_PUBLIC_* inlines at build → set it in Vercel and redeploy.
 *
 * Loaded UNCONDITIONALLY from the root layout (NOT behind cookie consent): AdSense
 * verification + serving need the tag on every page. For EEA/GDPR, the correct
 * lever is Google Consent Mode v2 (signal consent to Google), not withholding the
 * script — a follow-up (M5 compliance). The cookie banner still gates Analytics.
 */
export function AdSenseScript() {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT?.trim()
  if (!client) return null
  return (
    <script
      async
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(
        client,
      )}`}
      crossOrigin="anonymous"
    />
  )
}

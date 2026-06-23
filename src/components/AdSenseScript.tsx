import Script from 'next/script'

/**
 * AdSenseScript — loads Google AdSense Auto Ads. With this page-level script
 * present, Google automatically places ads (formats are configured in the AdSense
 * dashboard — turn OFF Vignette/Anchor/Overlay there to honour the app's
 * non-invasive / no-CLS ad policy).
 *
 * Gated on the publisher client id (NEXT_PUBLIC_ADSENSE_CLIENT, e.g.
 * "ca-pub-1191181818524233"), so it's a no-op in dev/CI/e2e where it's unset. The
 * id is public (it ships in the script src on every page). NEXT_PUBLIC_* inlines
 * at build → set it in Vercel and redeploy. Rendered only AFTER cookie consent
 * (see CookieConsent), so ad cookies aren't set until the visitor opts in.
 */
export function AdSenseScript() {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT?.trim()
  if (!client) return null
  return (
    <Script
      id="adsbygoogle-init"
      async
      strategy="afterInteractive"
      crossOrigin="anonymous"
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(
        client,
      )}`}
    />
  )
}

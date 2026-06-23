// affiliate.ts — central affiliate-link tagging for outbound provider/merch URLs.
//
// Senpai links OUT to licensed providers (WhereToWatch); where we have an
// affiliate relationship we append the program's tag so those clicks earn
// commission. Tags come from env (NEXT_PUBLIC_*, since an affiliate tag is public
// — it rides in the visible outbound URL and inlines at build time), so this is a
// no-op until configured. Unknown hosts and untagged programs pass through
// UNCHANGED (verbatim string), and a malformed URL returns the original. Never
// throws.
//
// Amazon Associates only — Crunchyroll's affiliate program is deprecated. Note:
// WhereToWatch currently surfaces streaming providers (Crunchyroll/Netflix/Prime
// Video), not amazon.com product links, so this fires on FUTURE merch/Amazon
// surfaces rather than today's streaming links; the central tagger is ready for
// them.

function amazonTag(): string | undefined {
  return process.env.NEXT_PUBLIC_AFFILIATE_AMAZON?.trim() || undefined
}

// Registrable domain is amazon.<tld> (amazon.com, www.amazon.com, amazon.co.jp,
// smile.amazon.com, …). Anchored to the END so amazon.evil.com never matches.
function isAmazonHost(host: string): boolean {
  return /(^|\.)amazon\.[a-z.]{2,6}$/.test(host)
}

/** Append the Amazon Associates `tag` to amazon.* URLs when configured; otherwise
 *  return the URL unchanged. Idempotent (re-tagging overwrites the same param). */
export function tagAffiliateUrl(url: string): string {
  const tag = amazonTag()
  if (!tag) return url

  let u: URL
  try {
    u = new URL(url)
  } catch {
    return url
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return url

  if (isAmazonHost(u.hostname.toLowerCase())) {
    u.searchParams.set('tag', tag)
    return u.toString()
  }
  return url
}

# Lighthouse (M2 acceptance: scores ≥ 90)

The M2 acceptance gate is **Lighthouse ≥ 90** for performance, accessibility,
best-practices, and SEO. There is no heavy CI tooling for this (the repo has no
`.github/` workflows); it's a manual/on-demand check via the `lighthouse` CLI.

## How to run

> **Run against the deployed site, not `next start` locally.** Local `next start`
> does on-demand image optimization with no CDN, so the first `/_next/image`
> request is slow and inflates LCP (home scored perf 77 locally vs **90** on
> prod). Only a11y/SEO/best-practices are meaningful locally.

```bash
# audit a route on production (or a Vercel preview URL)
npx -y lighthouse https://streaming-site-one.vercel.app/ \
  --only-categories=performance,accessibility,best-practices,seo \
  --chrome-flags=--headless=new --output=json --output-path=/tmp/lh.json --quiet

# read the four scores
jq -r '.categories | to_entries[] | "\(.key): \((.value.score*100)|round)"' /tmp/lh.json
```

Validate with Chrome DevTools or [PageSpeed Insights](https://pagespeed.web.dev/)
for a field-data cross-check.

## Verified baseline — production, 2026-06-22

| Route | perf | a11y | best-practices | SEO |
|---|---|---|---|---|
| `/` (home) | 90 | 96 | 100 | 100 |
| `/shows` | 93 | 96 | 100 | 100 |
| `/shows/<slug>` | 90+¹ | 96 | 96 | 92 |

¹ The show page measured **perf 73 / LCP 8.6s** before the fix: the official
YouTube embed loaded ~900KB of player scripts on page open, saturating the
critical path. `OfficialEmbed` is now a **click-to-load facade** (poster + play
button → iframe injected on click), removing the player from initial load.
**Re-run the show-page audit after this deploys** to confirm it clears ≥ 90.

## Levers if a route dips below 90

- Performance is gated by **LCP** on image-heavy pages. The hero/cover images
  already set `priority` + `sizes`; the main remaining cost is third-party
  embeds — keep them behind a facade / `loading="lazy"`.
- Home is `force-dynamic` (weighted-random ad slot), so it's SSR'd per request —
  a cold serverless start can shave a few points; re-run if it's borderline.

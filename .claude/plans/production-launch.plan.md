# Plan: Senpai Production Launch

**Source PRD:** [.claude/prds/production-launch.prd.md](../prds/production-launch.prd.md)
**Selected milestones:** M0–M6 (execute in order)
**Complexity:** Large (multi-milestone); M1/M3/M4 are Medium each

## Summary
Launch Senpai as a legal **discovery + community + official-embeds** product on Vercel.
Replace test-stream playback with AniList-powered **"where to watch"** + official embeds,
then monetize with **affiliate → display ads → Stripe premium** (ad-free, content never
gated). Each engineering milestone reuses existing patterns; M0/M5 are mostly legal/ops.

## Patterns to Mirror
| Category | Source | Pattern |
|---|---|---|
| Live aggregator + fallback | `src/lib/data/news.ts` | `fetch(..., { next: { revalidate } })` + `Promise.allSettled` + seed fallback; map → domain type; never throw |
| Seed-fallback data fn | `src/lib/data/schedule.ts` | `isSupabaseConfigured()` gate; live query in `try`, log + fallback in `catch` |
| Ads placement → render → track | `src/lib/data/ads.ts`, `src/components/AdSlot.tsx`, `AdSlotTracker.tsx` | reserved-height in-flow slot; impression/click via server action |
| Read-only public table | `supabase/migrations/0007_ads.sql` | table + `enable row level security` + public `select` policy + `grant select` |
| Owner-private table + definer RPC | `supabase/migrations/0009_watch_progress.sql` | private RLS, `auth.uid()`-pinned `security definer` fn, `set search_path=''` |
| Server actions | `src/lib/auth/actions.ts`, `src/lib/watch/actions.ts` | `'use server'`, `getServerClient()`, return `{error?}`, no throw to UI |
| Data barrel | `src/lib/data/index.ts` | UI imports from `@/lib/data`, never Supabase directly |
| Generated DB types | `src/lib/database.types.ts` | add new tables here to keep the typed client compiling |
| Tests | `*.test.ts(x)` (Vitest, mocked `fetch`/Supabase) + `e2e/*.spec.ts` (Playwright) | unit mocks externals; e2e drives real browser |

## Files to Change (by milestone)
| Milestone | File | Action | Why |
|---|---|---|---|
| M1 | `src/lib/data/where-to-watch.ts` | CREATE | AniList aggregator (streaming links/embeds), mirrors `news.ts` |
| M1 | `src/lib/data/index.ts`, `types.ts` | UPDATE | export `getWhereToWatch`, add `StreamingLink` type |
| M1 | `src/components/WatchSection.tsx` | UPDATE | replace test-stream play with embed-or-"where to watch" |
| M1 | `src/components/WhereToWatch.tsx`, `OfficialEmbed.tsx` | CREATE | provider deep-links (affiliate) + YouTube IFrame embed |
| M1 | `scripts/build_seed.mjs` (or a mapping table) | UPDATE | carry `idMal` so shows map to AniList |
| M3 | `src/components/AdSlot.tsx`, `src/lib/data/ads.ts` | UPDATE | render real ad-network units; respect premium |
| M3 | `src/lib/affiliate.ts` | CREATE | tag outbound watch/merch URLs with affiliate IDs |
| M4 | `supabase/migrations/00NN_subscriptions.sql` | CREATE | `subscriptions` table + RLS + `is_premium` |
| M4 | `src/app/api/stripe/webhook/route.ts` | CREATE | Stripe webhook → upsert entitlement |
| M4 | `src/lib/billing/actions.ts`, `src/lib/billing/entitlements.ts` | CREATE | checkout session, portal, `getEntitlement()` |
| M4 | `src/components/AdSlot.tsx` | UPDATE | suppress ads for premium |
| — | *(offline / PWA)* | DEFERRED | future, licensed-content goal — not in M4 |
| M0/M2/M5 | `src/app/(legal)/*`, `next.config`, monitoring | CREATE/UPDATE | legal pages, headers, Sentry, consent |

## Milestones & Tasks

### M0 — Legal & business foundation *(gating; mostly non-code)*
- **Action:** Form entity; engage counsel; publish **Terms of Service, Privacy Policy, DMCA policy**; register a **DMCA designated agent** (US Copyright Office); add **cookie/consent** banner; define content-moderation + acceptable-use policy; pick age rating.
- **Code touchpoints:** `src/app/(legal)/terms`, `/privacy`, `/dmca` route group; consent component.
- **Validate:** legal pages reachable + linked in footer; consent gate blocks non-essential cookies until accepted.

### M1 — Where-to-watch + official embeds *(first engineering milestone)*
- **Task 1 — AniList data layer.** CREATE `where-to-watch.ts`: GraphQL `Media(idMal:)` → `externalLinks{site,url,type,language}` (filter `type=STREAMING`) + `streamingEpisodes{title,url,site,thumbnail}`. **Mirror** `news.ts` (revalidate-cached `fetch`, `allSettled`, never throw, fallback to "no info yet").
- **Task 2 — Map shows → AniList.** Carry `idMal` on shows (extend `build_seed.mjs`) or title-search fallback.
- **Task 3 — UI.** CREATE `WhereToWatch.tsx` (provider buttons, affiliate-tagged, `rel="noopener noreferrer"`) and `OfficialEmbed.tsx` (YouTube IFrame for allow-listed official channels). UPDATE `WatchSection.tsx`: if an official embeddable URL exists → embed; else show WhereToWatch panel. Remove Mux test streams.
- **Mirror:** `NewsCard` external-link safety; `AdSlot` reserved-height to avoid CLS.
- **Validate:** `npm run typecheck && npm run lint && npm test`; e2e: show page renders embed OR ≥1 legal "watch on" link; no test-stream URLs remain (`rg test-streams.mux.dev` is empty).

### M2 — Production hardening
- **Tasks:** secrets/env audit (no secrets client-side); **Sentry** (or equivalent) for errors; **rate limiting** on API routes/actions; **RLS audit** of all tables; DB **backups** + PITR on Supabase prod; **SEO** (sitemap, robots, canonical, OG already partial); **a11y** pass (WCAG AA); security headers (CSP for embeds), image/CSP allow-lists for AniList/MAL/YouTube.
- **Validate:** Lighthouse (perf/a11y/SEO/best-practices ≥ 90); RLS test suite green; security-headers check; `npm run build`.

### M3 — Revenue: affiliate + display ads
- **Task 1 — Affiliate.** CREATE `affiliate.ts`: tag outbound watch/merch URLs (Crunchyroll/Amazon/merch IDs) centrally; use in `WhereToWatch`.
- **Task 2 — Display ads.** UPDATE `AdSlot.tsx`/`ads.ts` to render a real network (Google Ad Manager/AdSense) in the existing reserved slots; keep non-invasive (no pop-ups/interstitials); lazy-load below the fold.
- **Mirror:** existing `AdSlot` impression/click tracking; reserved height (no CLS).
- **Validate:** ads render in slots for free users; affiliate links carry the tag; e2e asserts outbound `href` has affiliate param; no layout shift (CLS budget).

### M4 — Premium membership (Stripe; Spotify-style, content never gated)
- **Task 1 — Schema.** CREATE `00NN_subscriptions.sql`: `subscriptions(user_id, stripe_customer_id, stripe_subscription_id, status, current_period_end, ...)` + RLS (owner-read), `is_premium(user_id)` definer fn. **Mirror** `0009_watch_progress.sql`. Add to `database.types.ts`.
- **Task 2 — Billing.** CREATE `src/lib/billing/actions.ts` (Checkout Session + Billing Portal), `src/app/api/stripe/webhook/route.ts` (verify signature → upsert entitlement). **Never** handle raw card data; PCI stays with Stripe.
- **Task 3 — Entitlements.** `getEntitlement()` server util; UPDATE `AdSlot.tsx` to **suppress ads when premium**; gate power features (advanced notifications, unlimited lists, .ics export, early access). **Content stays ungated.**
- **Task 4 — (deferred).** Offline viewing is a future, licensed-content goal — **not in this milestone**. Premium at launch = ad-free + power features only, and **never restricts site/content access**.
- **Validate:** unit tests mock Stripe + entitlement; e2e: premium user sees no ads + unlocked features; webhook signature verified; ad-free toggles off on cancel.

### M5 — Compliance & ops
- **Tasks:** content moderation for forum/comments (report/queue/ban); GDPR/CCPA (data export/delete); incident runbooks; **load test** (k6/Artillery) the hot paths; uptime + alerting.
- **Validate:** moderation flow demo; data-export/delete works; load test meets p95 target.

### M6 — Launch
- **Tasks:** staging env; closed beta; SEO/marketing; monitoring dashboards; scaling runbook + AWS-migration tripwire doc.
- **Validate:** staging mirrors prod; beta feedback triaged; dashboards live; rollback documented.

## Validation (per milestone)
```bash
npm run typecheck && npm run lint && npm test && npm run build
npx playwright test            # e2e for the touched flows
rg -n "test-streams.mux.dev" src   # must be empty after M1
```

## Risks
| Risk | Likelihood | Mitigation |
|---|---|---|
| Offline expectation vs A+B model | Low | Resolved — offline deferred to a future licensed-content phase |
| AniList rate limits / mapping gaps | Med | revalidate cache + fallback (mirror `news.ts`); `idMal` mapping |
| Embedding a non-embeddable source | Med | allow-list official channels only; honor ToS |
| Stripe webhook security | Med | verify signature; idempotent upserts; least-privilege key |
| Ad revenue needs scale | High | lead with affiliate + premium; grow via SEO/community |

## Acceptance
- [ ] M0 legal pages + DMCA agent live; consent gating works
- [ ] M1: no test streams; every show shows a legal watch path (embed or link); gate green
- [ ] M2: Lighthouse ≥ 90; RLS audited; Sentry capturing; backups on
- [ ] M3: affiliate-tagged outbound links; ads render non-invasively, no CLS
- [ ] M4: Stripe premium removes ads + unlocks features; **never restricts site/content access**; offline deferred
- [ ] M5: moderation + GDPR flows; load test passes
- [ ] M6: staging + beta + monitoring; AWS tripwire documented
- [ ] Patterns mirrored (news/ads/migrations/actions), not reinvented
```

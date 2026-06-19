# PRD: Senpai — Production Launch (Discovery + Community + Embeds)

**Status:** Draft (awaiting confirmation)
**Owner:** Spencer Karrat
**Last updated:** 2026-06-18
**Companion plan:** [.claude/plans/production-launch.plan.md](../plans/production-launch.plan.md)

---

## 1. Problem & opportunity

Senpai is already a capable anime **discovery + community** platform (catalog, rolling
schedule, live news, forum, comments, watch-progress, recommendations) built on
Next.js 16 + Supabase + Vercel. The only thing it *can't* legally do today is stream
licensed anime — the player currently points at Mux **test** streams.

Rather than take on the cost and legal exposure of a licensed catalog, we launch as a
**legal discovery/community product** (like AniList / LiveChart / MyAnimeList) that tells
users **where to legally watch** each title and **embeds officially-free** streams where
available. This reuses ~80% of what's built and is shippable without content licenses.

## 2. Goals

- Ship a **legal, production-grade** product for public use.
- Replace test-stream playback with **"Where to watch"** deep-links + **official free embeds**.
- Monetize via **affiliate + display ads + a premium membership** (ad-free, non-restrictive).
- Stay on **Vercel** for launch; keep the door open to AWS later as a cost decision.

## 3. Non-goals (this launch)

- Hosting/streaming licensed anime ourselves (models C/D) — future, gated on licensing.
- True **offline video download** (requires owned/DRM'd content — see §7 decision).
- Native mobile apps (web/PWA only at launch).
- Original/UGC video hosting.

## 4. Target users

- **Anime viewers** who want one place to track what's airing, discover titles, see where
  to watch them legally, read news, and discuss — across the services they already use.
- **Signed-in members** who want power features + an ad-free experience.

## 5. Confirmed decisions

| Area | Decision |
|---|---|
| **Content model** | **A (discovery / "where to watch") + B (official free embeds)**. No self-hosted licensed video at launch. |
| **Where-to-watch data** | **AniList GraphQL API** (free, anime-native: `Media.externalLinks` STREAMING links + `streamingEpisodes`), mirroring the existing `news.ts` live-aggregator + seed-fallback pattern. Map our shows via `idMal` / title. |
| **Official embeds** | Embed officially-free streams (e.g. Muse Asia / Ani-One on YouTube) via the YouTube IFrame API where AniList/curation provides an official URL. Only embed sources that permit embedding. |
| **Hosting** | **Vercel** for launch (app + edge). AWS migration is a documented future *cost* tripwire, not a launch task. |
| **CDN** | Cloudflare (optional) in front of Vercel for DNS/WAF/DDoS. No self-hosted video CDN (no owned video). |
| **Revenue** | **Affiliate + display ads + premium membership**, in that build order. |
| **Premium model** | **Removes ads + unlocks power features; never restricts site or content access (purely additive).** Stripe-billed. Offline viewing deferred to a future licensed-content phase. |

## 6. Scope

**In scope**
- "Where to watch" provider integration (AniList) + UI on show/episode pages.
- Official-embed player path (YouTube IFrame) alongside a "watch on <service>" panel.
- Affiliate link tagging for outbound watch/merch links.
- Display-ad network integration wired to the existing `AdSlot` placements.
- Premium membership: Stripe subscription, entitlements, **ad-free** rendering, power features.
- Production hardening: secrets, monitoring (Sentry), rate limiting, RLS audit, backups, SEO, a11y, legal pages, DMCA agent, cookie consent.

**Out of scope (this launch)**
- Self-hosted/licensed video, DRM, geo-fencing, video ads (VAST), offline *video* download.

## 7. Premium principle — additive only; offline deferred

**Confirmed:** the subscription is **purely additive** — it **never restricts access to the
site or to any content**. The free tier keeps full access to everything (discovery,
schedule, news, forum, where-to-watch, embeds); premium only **removes ads and adds power
features**.

**Offline viewing is deferred.** With models A+B we don't own the video (it's served by
Crunchyroll/YouTube/etc.), so there's nothing of ours to legally download. Offline is a
**future goal gated on a licensed catalog (model C)** and is **not part of launch** — and
not advertised until it can be delivered.

## 8. Premium membership spec (Spotify-style)

| Tier | Price (TBD) | What you get |
|---|---|---|
| **Free** | $0 | Full discovery, schedule, news, forum, where-to-watch, embeds — **all content**, with non-invasive display ads. |
| **Premium** | e.g. $4.99/mo | **Ad-free** + power features: advanced airing notifications, unlimited custom lists, calendar (.ics) export, early access. **Never restricts site/content access — purely additive.** (Offline viewing is a future, licensed-content goal, not in launch.) |

- Billing via **Stripe** (Checkout + Billing Portal + webhooks). We never handle raw card data; PCI stays with Stripe.
- Entitlement source of truth: a Supabase `subscriptions` table keyed to the user; `profiles.role` / an `is_premium` view drives ad suppression + feature gates.

## 9. Success metrics

- **Legal/launch readiness:** ToS/Privacy/DMCA live; zero unlicensed video; passes security + a11y review.
- **Engagement:** WAU, schedule/where-to-watch click-through, watchlist adds, news CTR.
- **Revenue:** affiliate conversions, ad RPM/fill, premium conversion % and churn.
- **Reliability:** p95 latency, error rate (Sentry), uptime; video-embed start success rate.

## 10. Delivery Milestones

| # | Milestone | Status | Plan |
|---|---|---|---|
| M0 | Legal & business foundation (entity, ToS/Privacy/DMCA agent, consent, policies) | pending | [plan](../plans/production-launch.plan.md) |
| M1 | Where-to-watch + official embeds (AniList integration, player/watch UI) | pending | [plan](../plans/production-launch.plan.md) |
| M2 | Production hardening (secrets, Sentry, rate limit, RLS audit, backups, SEO, a11y) | pending | [plan](../plans/production-launch.plan.md) |
| M3 | Revenue: affiliate links + display-ad network into `AdSlot`s | pending | [plan](../plans/production-launch.plan.md) |
| M4 | Premium membership (Stripe, entitlements, ad-free, power features, PWA offline) | pending | [plan](../plans/production-launch.plan.md) |
| M5 | Compliance & ops (moderation, GDPR/CCPA, runbooks, load test) | pending | [plan](../plans/production-launch.plan.md) |
| M6 | Launch (staging, beta, SEO/marketing, monitoring) | pending | [plan](../plans/production-launch.plan.md) |

## 11. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Advertising offline video we can't legally deliver | Low | High (legal/trust) | Resolved — offline deferred; never advertised until licensed content exists |
| Embedding a source that forbids embedding | Med | Med | Only embed allow-listed official channels; honor robots/ToS |
| Ad revenue needs scale | High | Med | Lead with affiliate + membership; grow via SEO/community |
| AniList API limits / mapping gaps | Med | Med | Cache + seed fallback (mirror `news.ts`); graceful "no info yet" |
| Moderation liability (forum/comments) | Med | Med | Policy + reporting + moderation tooling; DMCA posture |
| Vercel cost growth | Low–Med | Med | Cloudflare in front; documented AWS tripwire |

## 12. Open questions

- ~~D1: offline~~ — **resolved:** offline deferred (future, licensed content); premium is additive-only.
- Premium price point and trial?
- Affiliate programs to join first (Crunchyroll, Amazon, merch)?
- Ad network: Google Ad Manager vs AdSense vs anime-niche?

---

*Next:* on confirmation, execute milestones in order via the companion plan. M0 is largely
legal/ops (not code); M1 is the first engineering milestone.

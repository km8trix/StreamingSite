# COORDINATION.md — Anime Streaming Site (Milestone 1)

Shared source of truth for the multi-agent build. **Every agent: read this fully before
working, and append a dated entry to the Status Log when you finish.** The human "lead"
(main Claude session) routes work between agents in dependency order.

---

## Build environment (IMPORTANT — read before running anything)

- **Node 20 required** (Next 16 / React 19 / Tailwind v4). Node 20 is on PATH via
  `~/.bun/bin` symlinks; `node -v` should print `v20.x`. If it ever prints `v18`, run:
  `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"` at the start of the command.
- **Package manager: npm.** All Milestone-1 dependencies are already installed. Do **not**
  run `npm install` for a new package without telling the lead (network is sandboxed; the
  lead installs deps in a controlled step).
- **Fact-Forcing Gate:** a hook blocks *every* Bash command and *every* Edit/Write the
  first time you call it. When blocked, briefly present the requested facts in your message,
  then retry the identical call — it will succeed. This is expected. Comply concisely and
  keep moving; do not treat it as an error.

---

## Scope — Milestone 1 = Phases 0–3 ONLY

**IN scope:**
- Home page with three rails: *Recently Updated*, *Popular*, *Recommended*.
- Show cards: cover artwork, title, and **sub/dub episode-count badges**.
- Show detail page: synopsis, genres, episode list, and a **player placeholder** (no real video).
- **Randomizer** button that sends the user to a random show.

**OUT of scope (later milestones — build NOTHING for these now):**
release schedule page · search & filtering · auth/accounts · comments · forum ·
real video playback · advertising. (You may leave schema/layout room for them, but do not implement.)

---

## Stack & conventions

- Next.js 16 **App Router**; React 19 **Server Components by default** — add `'use client'`
  only for interactive components (e.g. the randomizer button, carousels).
- TypeScript strict. Tailwind v4 (CSS-first `@theme` in `src/app/globals.css`).
- Path alias `@/*` → `src/*`.
- Routes kebab-case; components PascalCase in `src/components/`; shared code in `src/lib/`.
- **UI never calls Supabase directly** — all reads go through `src/lib/data/*`.
- Use `next/image` for artwork; external image hosts must be allowlisted in `next.config.ts`
  (DB engineer lists the seed's image domains; lead/UI wires them in).
- Dark-first visual theme.

---

## Data contract  (DB engineer implements · UI consumes · reviewer enforces)

Types live in `src/lib/data/types.ts`:

```ts
export type ShowStatus = 'airing' | 'finished' | 'upcoming'

export type Genre = { id: string; name: string; slug: string }

export type ShowSummary = {
  id: string
  slug: string
  title: string
  coverImage: string        // absolute URL
  subEpisodes: number       // drives "SUB n" badge
  dubEpisodes: number       // drives "DUB n" badge
  status: ShowStatus
  year: number | null
}

export type Episode = {
  id: string
  number: number
  title: string
  isSubbed: boolean
  isDubbed: boolean
  airDate: string | null    // ISO date (YYYY-MM-DD) or null
}

export type ShowDetail = ShowSummary & {
  synopsis: string
  bannerImage: string | null
  genres: Genre[]
  episodes: Episode[]
  popularityScore: number
  updatedAt: string         // ISO timestamp
}
```

Server-side async functions (in `src/lib/data/shows.ts`, re-exported from `src/lib/data/index.ts`):

```ts
getRecentlyUpdatedShows(limit?: number): Promise<ShowSummary[]>   // default 12, order by updatedAt desc
getPopularShows(limit?: number): Promise<ShowSummary[]>           // default 12, order by popularityScore desc
getRecommendedShows(limit?: number): Promise<ShowSummary[]>       // default 12, simple genre/score heuristic for M1
getAllShows(): Promise<ShowSummary[]>
getShowBySlug(slug: string): Promise<ShowDetail | null>
getRandomShow(): Promise<ShowSummary | null>                      // powers the randomizer
listGenres(): Promise<Genre[]>
```

**Fallback behavior (critical):** if Supabase is not configured
(`isSupabaseConfigured() === false`), these functions must read bundled seed data
(`src/lib/data/seed.json`) so the app fully builds and renders **without a live database**.
When Supabase *is* configured, query it. This lets every agent build/test offline today and
flip to live Supabase later by setting env vars only.

---

## Task ownership

| Agent | Owns |
|---|---|
| **DB engineer** | `supabase/migrations/*.sql` (shows, genres, show_genres, episodes + public-read RLS), seed (`supabase/seed/*.sql` + `src/lib/data/seed.json`), `src/lib/data/types.ts`, `src/lib/data/shows.ts` (+ `index.ts`) with seed fallback, `src/lib/supabase/{client,server,config}.ts`, `src/lib/database.types.ts`, `.env.example`, image domains list for `next.config.ts` |
| **UI/UX designer** | theme/tokens in `globals.css`, root `layout.tsx` (header: logo + nav + search-bar placeholder + **Randomize** button; footer), `src/lib/utils.ts` (`cn`), components (`ShowCard`, `ShowGrid`, `ShowCarousel`, `EpisodeList`, player placeholder), routes (`/` home, `/shows/[slug]` detail, `/random` route handler), loading/empty states. **Consumes `src/lib/data/*` only.** |
| **Code reviewer** | Read-only review of all DB + UI code; findings ranked Critical/High/Medium/Low; explicit **APPROVE** or **BLOCK** with required fixes. |
| **QA tester** | `vitest.config.ts` + setup, `playwright.config.ts`, unit tests (ShowCard badges, data fallback, randomizer, rails render) + e2e (home loads → click card → detail; randomize navigates). |

---

## Status log  (append: `YYYY-MM-DD — agent — what changed — handoff notes`)

- 2026-06-15 — lead — Phase 0 foundation: Next 16 + React 19 + Tailwind v4 scaffold, deps
  (supabase, zod, lucide, cva/clsx/tailwind-merge, vitest, RTL, playwright + chromium),
  npm scripts (typecheck/test/test:e2e), `.nvmrc`, this doc. Next: DB engineer (data contract above).
- 2026-06-15 — db-engineer — Data layer complete (no UI). Built:
  - `supabase/migrations/0001_init.sql`: tables `genres`, `shows`, `show_genres` (join),
    `episodes`; text PKs matching seed ids (e.g. `show-001`); indexes (unique slug on
    shows+genres, popularity desc, updated_at desc, status, FK cols); `updated_at` trigger
    on shows; **RLS enabled on all 4 tables with public (anon+authenticated) SELECT policies,
    no write policies** (catalog is read-only from the app).
  - Seed: **24 real anime from the Jikan API** (MyAnimeList) → `src/lib/data/seed.json`
    (full ShowDetail records) AND `supabase/seed/seed.sql` (idempotent truncate+insert,
    FK-safe order). 24 shows, 11 genres, 68 genre links, 410 episodes. Real:
    titles/synopses/cover URLs (`cdn.myanimelist.net`, verified resolving)/genres/sub counts.
    Synthesized: `dubEpisodes` (rule in `scripts/build_seed.mjs synthDub`: upcoming=0; ≥2024
    shows 0–40%; 2022–23 ~60–95%; older fully dubbed; always ≤ sub), episode lists, updatedAt
    spread. Regenerate with `node scripts/build_seed.mjs` (needs re-fetched Jikan JSON).
  - `src/lib/data/types.ts` (contract types verbatim), `src/lib/data/shows.ts` +
    `index.ts` (all 7 contract functions, seed-fallback when `!isSupabaseConfigured()`,
    row→domain mapping centralized; raw rows never leak).
  - `src/lib/supabase/{config,client,server}.ts` (`@supabase/ssr`, Next 16 async
    `cookies()`, import-safe; `isSupabaseConfigured()` gates everything).
  - `src/lib/database.types.ts` (hand-authored `Database` type).
  - `.env.example` (Supabase vars, optional for M1) — note: gitignored by `.env*`,
    exists on disk only.
  - `next.config.ts`: `images.remotePatterns` for `cdn.myanimelist.net` (/images/**)
    and `placehold.co` (fallback host).
  - Validation: `npm run typecheck` clean; `npm run build` succeeds via seed-fallback path.
  - Handoff to UI: import data from `@/lib/data` ONLY (never Supabase). Functions:
    `getRecentlyUpdatedShows`, `getPopularShows`, `getRecommendedShows`, `getAllShows`,
    `getShowBySlug`, `getRandomShow`, `listGenres` — all async, default limit 12.
    All are async server fns (use in Server Components / Route Handlers; `getServerClient`
    uses `next/headers`). `getRandomShow` is non-deterministic (don't call during static
    prerender of a cached page). Cover URLs are absolute https; wire `next/image` already
    allowlisted. `bannerImage` is `null` for all seed shows (Jikan has no wide banner) —
    design detail page to tolerate null banner. No deviations from the contract.
- 2026-06-15 — ui-ux-designer — Frontend + visual design complete (Phases 0-design, 2, 3).
  Built (all consume `@/lib/data` only; Server Components by default):
  - **Theme** (`src/app/globals.css`): dark-first `@theme` tokens — background `#08080c`,
    surface/card layers, foreground/muted/subtle text (AA contrast), vivid **violet accent**
    (`#8b5cf6`), semantic **sub=cyan / dub=pink** badge colors, airing=green, borders, radii.
    Ambient top glow, themed focus ring, `.no-scrollbar` util, reduced-motion guard.
  - **`src/lib/utils.ts`**: `cn()` (clsx + tailwind-merge).
  - **Root `layout.tsx`**: sticky glass header (Logo "Senpai" + Home/Browse nav + disabled
    "Search — coming soon" field + prominent **Randomize** button), footer, skip-link,
    metadata (title template, OG). Geist fonts.
  - **Components** (`src/components/`, PascalCase): `ShowCard` (server, 2:3 cover, hover lift,
    badges over gradient), `ShowGrid` (server, responsive 2→6 cols, empty state),
    `ShowCarousel` (**client** — scroll buttons + arrow state, takes plain data),
    `EpisodeList` (server, per-ep sub/dub chips, single-episode safe), `PlayerPlaceholder`
    (server, 16:9 "Streaming coming soon"), `RandomizeButton` (**client**, pending spinner,
    `<a href="/random">` fallback), `SubDubBadges`, `StatusBadge`, `FeaturedHero`,
    `SiteHeader`, `SiteFooter`, `Logo`, `SearchPlaceholder`, `NavLink` (**client**, active
    route), `Skeleton`/`CardRailSkeleton`.
  - **Routes**: `/` (hero from top popular + 3 rails), `/shows/[slug]` (hero tolerant of
    null banner via blurred cover fallback; badges/genres/synopsis/player/episodes;
    `generateStaticParams` + `generateMetadata`; **`dynamicParams = false`** so unknown
    slugs return a true **404**; `notFound()` still guards live-Supabase path),
    `/random` (**`force-dynamic`** route handler → redirect to `/shows/[slug]`, home if null),
    `/shows` (browse-all grid). Plus `loading.tsx` (home + detail skeletons) and a custom
    `shows/[slug]/not-found.tsx`.
  - **Validation**: `npm run typecheck` clean · `npm run lint` clean · `npm run build` OK
    (home/browse static, all 24 shows SSG-prerendered, `/random` dynamic). Smoke-tested:
    home 200 (35 cards, badges present), detail 200, `/random` 307→valid slug,
    unknown slug 404.
  - **Handoff to reviewer/QA**: data-testids added for testing — `show-card` (+`data-slug`),
    `show-grid`, `carousel-scroller`, `badge-sub`, `badge-dub`, `status-badge`,
    `episode-list`, `episode-row`, `player-placeholder`, `randomize-button`,
    `search-placeholder`, `featured-hero`. Client components: ShowCarousel, RandomizeButton,
    NavLink (only these). Known: search input is intentionally `disabled` (later milestone);
    DUB badge shows greyed "DUB 0" when no dub. No new deps installed.
- 2026-06-15 — qa-tester — Full test suite added + run green (no product code touched).
  - **Configs**: `vitest.config.ts` (jsdom, globals, `@`→`src` alias, setup file,
    include `src/**/*.{test,spec}.{ts,tsx}`, excludes `e2e/`), `vitest.setup.ts`
    (`@testing-library/jest-dom/vitest` + `vi.mock('next/headers')` so the data layer's
    transitive `next/headers` import loads under vitest — seed-fallback path only, so
    `getServerClient()` is never actually called), `playwright.config.ts` (testDir `e2e/`,
    baseURL `http://localhost:3000`, webServer `npm run build && npm run start`,
    reuseExistingServer when not CI, chromium project, 180s server boot timeout).
  - **Unit (Vitest + RTL) — 41 tests / 6 files, all pass**: `src/test/fixtures.ts`
    (synthetic ShowSummary/ShowDetail/Episode/Genre builders matching the contract).
    Components: `ShowCard` (title, cover alt, SUB n, DUB n, **DUB 0 greyed case**, links
    to `/shows/[slug]`, year null→"—"), `SubDubBadges`, `StatusBadge` (airing ping dot),
    `EpisodeList` (rows, per-ep sub/dub indicators, single-episode movie, empty state,
    air-date formatting), `PlayerPlaceholder` (renders, **no real `<video>`**, a11y label).
    Data layer (seed fallback, env unset, guarded by `expect(isSupabaseConfigured()).toBe(false)`):
    `getRecentlyUpdatedShows` (updatedAt desc + default 12 + summary shape, no detail leak),
    `getPopularShows` (popularityScore desc + default 12), `getRecommendedShows`
    (airing-first), `getAllShows`, `getShowBySlug` (real slug → ShowDetail w/ sorted
    episodes; **missing slug → null**), `getRandomShow` (in-set; Math.random-driven index),
    `listGenres` (non-empty, sorted).
  - **E2E (Playwright/chromium) — 6 tests / 3 files, all pass**: home loads + ≥1 `show-card`
    + three rail headings; click card → `/shows/[slug]` w/ title+badges+player+episode-list;
    Randomize button → detail page; `/random` → detail redirect; unknown slug → **404**.
  - **Results**: `npm run test` 41/41 pass (~1.2s); `npm run test:e2e` 6/6 pass (~12s).
  - **Observation (LOW, not patched — for reviewer/lead)**: requesting an unknown slug
    serves a correct **404** (asserted), but Next logs a one-off internal
    `Error: NoFallbackError` server-side. This is a cosmetic log artifact of
    `dynamicParams = false` (`src/app/shows/[slug]/page.tsx:18`) meeting a non-prerendered
    path; user-facing HTTP contract is correct. Repro: `curl -i localhost:3000/shows/x`
    → 404 with the error printed to the server console. No product code changed.
  - **Coverage notes / deferred**: client islands `ShowCarousel`/`NavLink` and presentational
    `FeaturedHero`/`Logo`/`SearchPlaceholder`/`SiteHeader`/`Skeleton` are exercised indirectly
    via e2e but have no dedicated unit tests (out of the M1 ask). Supabase live-query path is
    untested (M1 runs seed-fallback only). RandomizeButton's client `useTransition`/`router.push`
    interception is covered via e2e click, not a unit test.
- 2026-06-15 — code-reviewer — Reviewed all DB + UI code. **VERDICT: APPROVE** (0 Critical,
  0 High, 4 Medium, 3 Low). Confirmed: contract adherence exact, no direct Supabase imports
  in UI, service-role key never client-side, RLS public-read-only correct, server/client
  boundaries clean, `/random` force-dynamic + null-safe, `cookies()` awaited, `next/image`
  sized (no CLS), null banner handled, a11y largely solid. Mediums: (1) EpisodeList date TZ
  off-by-one, (2) RandomizeButton suppressed focus ring (a11y), (3) getRandomShow over-fetch
  on live-Supabase path (note for M2), (4) SiteFooter year stamped at build (cosmetic). Lows:
  popularity sort-column smell, episode `number>=0` check, skeleton index keys (false positive).
- 2026-06-15 — lead — Applied reviewer Mediums #1 & #2 (owned by UI): EpisodeList now parses
  Y/M/D explicitly (TZ-safe); RandomizeButton focus ring restored. Re-verified: typecheck ✓
  lint ✓ unit 41/41 ✓ build ✓. Mediums #3/#4 + all Lows deferred (non-blocking, noted for M2).
  **Milestone 1 (Phases 0–3) complete and ship-ready.** Next: M2 (release schedule + search/filter).

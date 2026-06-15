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

---

# Milestone 2 — scope & contract addendum (2026-06-15)

**Branch:** `feat/milestone-1-catalog` (continue here). Same conventions/env rules as above.
M1 is committed (`cd15b7e`); do not regress it. Reuse existing components (ShowCard, ShowGrid)
and the data layer pattern (seed fallback when `!isSupabaseConfigured()`).

## M2 scope = Phases 4–5 ONLY
**IN:**
- **Release schedule page** (`/schedule`): weekly grid (7 days × air times) of currently-airing
  shows, times converted to the **viewer's local timezone** (source times are JST).
- **Search & filter** (`/search`): functional header search + a filter panel
  (title query, genre, sub/dub, status, year) with sort, URL-synced, results grid.

**OUT (later):** auth/accounts, comments, forum, real video, ads.

## New data contract (DB engineer implements · UI consumes · reviewer enforces)

New table `airing_slots` (migration `0002_*.sql`, RLS public SELECT only):
`id text pk · show_id fk→shows · day_of_week smallint 0–6 (0=Monday … 6=Sunday) ·
air_time text 'HH:MM' 24h · timezone text default 'Asia/Tokyo' · season text`.
Seed an air slot for each **status='airing'** show (spread across days/times; src TZ JST).
Add slots to `src/lib/data/seed.json` (or a sibling seed file the data layer reads) AND
`supabase/seed/seed.sql`.

Types (extend `src/lib/data/types.ts`):
```ts
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6   // 0=Monday … 6=Sunday
export type ScheduleEntry = {
  show: ShowSummary
  dayOfWeek: DayOfWeek
  airTime: string      // 'HH:MM' 24h, in `timezone`
  timezone: string     // IANA, e.g. 'Asia/Tokyo'
}
export type ShowSort = 'title' | 'popularity' | 'recent' | 'year'
export type AudioFilter = 'any' | 'sub' | 'dub'
export type ShowFilter = {
  query?: string
  genres?: string[]    // genre slugs; OR semantics (match any selected)
  audio?: AudioFilter  // 'sub' => subEpisodes>0, 'dub' => dubEpisodes>0
  status?: ShowStatus
  year?: number
  sort?: ShowSort      // default 'popularity'
}
export type ShowFilterResult = { shows: ShowSummary[]; total: number }
```

New functions (in `src/lib/data/schedule.ts` and `src/lib/data/search.ts`, re-exported from `index.ts`):
```ts
getWeeklySchedule(): Promise<ScheduleEntry[]>            // all airing shows' slots
searchAndFilterShows(filter: ShowFilter): Promise<ShowFilterResult>
listFilterYears(): Promise<number[]>                     // distinct years desc, for the year filter
```
Both honor the seed-fallback contract (filter/sort in memory when no Supabase; ilike/where/order
when configured). Title search = case-insensitive substring. `listGenres()` already exists for the
genre filter.

## Status log — M2 entries

- 2026-06-15 — db-engineer-m2 — M2 data layer complete (no UI). Built:
  - `supabase/migrations/0002_airing_slots.sql`: table `airing_slots` (id text pk,
    show_id fk→shows ON DELETE CASCADE, day_of_week smallint CHECK 0–6 where 0=Monday…6=Sunday,
    air_time text 'HH:MM', timezone text default 'Asia/Tokyo', season text). Indexes on
    show_id and day_of_week. RLS enabled; public (anon+authenticated) SELECT only, no write
    policies — matches 0001 style exactly.
  - Seed: 2 airing slots (all shows with status='airing' in seed.json):
    slot-001 → show-002 (Steel Ball Run) Saturday (day_of_week=5) 17:00 JST Spring 2026;
    slot-002 → show-009 (Re:ZERO S4) Wednesday (day_of_week=2) 23:00 JST Spring 2026.
    Spread across 2 different days and 2 different times. Persisted to BOTH
    `src/lib/data/seed.json` (new top-level `airingSlots` array) AND
    `supabase/seed/seed.sql` (appended idempotent INSERT before commit, FK-safe — shows rows
    already exist). Only 2 airing shows exist in M1 seed; more can be added when status
    changes without touching the data layer.
  - `src/lib/data/types.ts` (additive only — M1 types untouched): added `DayOfWeek`,
    `ScheduleEntry`, `ShowSort`, `AudioFilter`, `ShowFilter`, `ShowFilterResult` exactly
    per contract.
  - `src/lib/data/schedule.ts`: `getWeeklySchedule(): Promise<ScheduleEntry[]>`.
    Seed-fallback: reads `seed.json.airingSlots`, joins to `seed.json.shows` in memory.
    Supabase path: joins airing_slots→shows, orders by day_of_week asc then air_time asc.
    airTime is always 'HH:MM' 24h in the slot's timezone (JST) — NOT converted here.
  - `src/lib/data/search.ts`: `searchAndFilterShows(filter): Promise<ShowFilterResult>`
    and `listFilterYears(): Promise<number[]>`. Seed-fallback: in-memory filter+sort.
    Supabase path: ilike for title, show_genres join for genre OR-filter, gt/eq for audio/
    status/year, order for sort. total = count of matches (no artificial limit imposed).
  - `src/lib/data/index.ts`: re-exports all new types + 3 new functions.
  - `src/lib/database.types.ts`: airing_slots table added (Row/Insert/Update/Relationships).
  - Validation: `npm run typecheck` clean · `npm run build` succeeds (seed-fallback, all 29
    pages) · `npm run test` 41/41 pass (M1 suite fully intact, no regressions).
  - UI handoff notes (CRITICAL):
    - Import from `@/lib/data` only: `getWeeklySchedule`, `searchAndFilterShows`,
      `listFilterYears`, plus all new types (`ScheduleEntry`, `ShowFilter`, etc.).
    - `airTime` in `ScheduleEntry` is always JST ('Asia/Tokyo'). The schedule page MUST
      convert to viewer local TZ at render time using `Intl.DateTimeFormat` or similar.
      Never convert in the data layer.
    - `dayOfWeek` convention: 0=Monday, 1=Tuesday, …, 5=Saturday, 6=Sunday (ISO week).
      This differs from JS `Date.getDay()` (0=Sunday). The UI must map accordingly.
    - `searchAndFilterShows` genres filter uses OR semantics (any matching genre slug
      includes the show). Pass genre slugs (not ids) in the `genres` array.
    - `listFilterYears()` returns `number[]` descending, nulls excluded — ready for a
      `<select>` dropdown.
    - `total` in `ShowFilterResult` is the full match count; no pagination applied yet.
    - `listGenres()` (M1, already exported) provides slug+name for the genre filter UI.

## M2 task ownership (deltas)
- **DB engineer:** `0002` migration + RLS, airing-slot seed (json + sql), the 3 functions above,
  type additions, `database.types.ts` update. Validate typecheck/build.
- **UI/UX designer:** `/schedule` (responsive weekly grid, JST→local conversion via `Intl`,
  empty-day + "today" handling, timezone note), `/search` (server page reading `searchParams`),
  `FilterPanel` (**client**, URL-synced via router) + a working header search form (enable the
  previously-disabled input → submit to `/search?q=`), nav link to Schedule. Reuse ShowGrid/ShowCard.
- **Code reviewer:** review M2 DB+UI; APPROVE/BLOCK.
- **QA tester:** unit (schedule grouping + TZ formatting, filter/sort/search logic incl. empty
  results) + e2e (schedule renders days; search query narrows results; a filter changes the grid).
- 2026-06-15 — qa-tester-m2 — M2 full test suite added + run green. No product code touched.
  - **Fixtures:** extended `src/test/fixtures.ts` with `makeScheduleEntry()` builder (ScheduleEntry,
    dayOfWeek=5/JST, airTime='17:00').
  - **Unit (Vitest + RTL) — 96 new tests / 4 new files, all 137 pass (41 M1 + 96 M2):**
    - `src/lib/data/schedule.test.ts` (9 tests): getWeeklySchedule seed-fallback — array return,
      slot count, ScheduleEntry shape, no detail leak, airing-only filter, no JST conversion,
      ISO dayOfWeek convention (0=Mon/5=Sat/2=Wed), 24h HH:MM format.
    - `src/lib/data/search.test.ts` (49 tests): searchAndFilterShows — baseline/no-filter,
      case-insensitive substring (lower/upper/mixed/trim/empty), genre OR filter (single/multi/
      nonexistent), audio sub/dub/any filters, status/year exact match, combined filters (title+
      status, year+audio, genre+dub), all 4 sort orders (popularity/title/recent/year),
      empty-result case (nonsense query → {shows:[],total:0}), default sort=popularity.
      listFilterYears — number[], no nulls, distinct, descending, correct set, 2026 deduped.
    - `src/components/FilterPanel.test.tsx` (33 tests): renders all control groups from props
      (sort/audio/status/year/genre); empty props suppress year+genre sections; defaults to
      popularity/any; all sort/audio/status/year/genre interactions call router.push with
      correct query string; reflects existing URL params; clear-filters preserves q, drops
      filter params, navigates to bare /search.
    - `src/components/ScheduleGrid.test.tsx` (18 tests): schedule-grid container, 7 columns
      (data-day=0..6), JST timezone note, empty days show "No releases", no crash on empty,
      entry cards render with title + /shows/[slug] link, ISO dayOfWeek convention (Mon=0/
      Sat=5/Sun=6 placement), cross-day isolation, TZ conversion numerics (JST 17:00→UTC 8:00,
      JST 23:00→UTC 14:00) pinned with process.env.TZ.
  - **E2E (Playwright/chromium) — 23 new tests / 2 new files, all 29 pass (6 M1 + 23 M2):**
    - `e2e/schedule.spec.ts` (8 tests): schedule-grid visible, 7 columns (×2 layouts), ≥2
      seeded airing entries visible, each entry links to /shows/[slug], clicking navigates to
      detail page, empty days render "No releases", page title, JST timezone note.
    - `e2e/search.spec.ts` (15 tests): filter-panel + search-results render, no-query default
      shows all 24 shows, ?q=frieren→1 result, ?q=gintama→>1 result, nonsense q→empty-state,
      heading reflects query, ?genres=action narrows, ?audio=dub narrows, ?audio=sub=all 24,
      ?status=airing→2 results, FilterPanel genre click→URL+grid update, audio click→URL update,
      header search-input submit→/search?q=, empty submit→/search, Clear button resets URL.
  - **M1 tests: 0 regressions** (41/41 still pass). No M1 test needed updating — the M1
    suite never tested the search input at all (SearchPlaceholder had data-testid=search-placeholder
    which is distinct from HeaderSearch's data-testid=search-input; no M1 test referenced either).
  - **Real product observation (LOW, not patched):** `/search` with no query returns all 24
    shows ("24 shows found"), not an "enter a search term" prompt. The server page code shows
    that the empty-state prompt only triggers when total===0 AND !hasActiveFilters; since no
    filter yields total=24, all shows display. This is intentional product behavior (browse-all
    default). Documented by correcting the initial test expectation; no product code touched.
  - **Results:** `npm run test` 137/137 pass (~1.9s); `npm run test:e2e` 29/29 pass (~10.4s).
- 2026-06-15 — code-reviewer-m2 — Reviewed M2 DB+UI. First pass: **VERDICT: BLOCK** — 1 HIGH
  (ScheduleGrid sorted day entries by `localeCompare` on 12h display strings → chronologically
  wrong), 3 Medium (search.ts Supabase genre `.in('genres.slug',…)` syntax; search.ts `total =
  shows.length` breaks under future pagination; schedule page not `force-dynamic`), 2 Low
  (seed truncate omits airing_slots; FilterPanel clear resets sort).
- 2026-06-15 — lead — Fixed blocking HIGH (ScheduleGrid now sorts by raw 24h `airTime`) and
  Medium (added `force-dynamic` to /schedule). Re-ran suite: typecheck ✓ lint ✓ unit 137/137 ✓
  e2e 29/29 ✓. **Re-review → VERDICT: APPROVE.** Deferred (documented, non-blocking, only affect
  the not-yet-active live-Supabase path): search.ts genre-filter query syntax + server-side
  `count:'exact'` total; the 2 Lows. **Milestone 2 (Phases 4–5) complete and approved.**
  M2 changes are uncommitted in the working tree (awaiting user OK to commit). Next candidate:
  M3 — accounts/auth → comments → forum.
- 2026-06-15 — db-engineer-m2-harden — Hardened M2 seed + applied the 2 deferred search.ts
  fixes. No migration/type/UI changes; no M1/M2 regressions.
  - **Seed enrichment (Task A):** added **15 new currently-airing shows** (`show-025`…`show-039`)
    from the **Jikan API** (`/v4/seasons/now`, Spring 2026 season), deduped by title AND MAL id
    against the existing 24. Real titles/synopses/cover URLs (all `cdn.myanimelist.net`, already
    allowlisted)/genres/popularity(members)/year. `subEpisodes` = weeks aired through 2026-06-15
    capped at planned total (10–11 each); `dubEpisodes` = 0 for every new airing show (≤ sub).
    Episodes arrays capped at 12 (weekly air dates from each show's start). `updatedAt` spread
    2026-06-01…06-15. Added **1 new genre** `gen-012` Slice of Life (only genuinely-missing one;
    all others reuse existing ids). Persisted to BOTH `src/lib/data/seed.json`
    (shows[]+airingSlots[]+genres[]) AND `supabase/seed/seed.sql` (FK-safe INSERTs, counts
    verified equal across both files).
  - **airing_slots:** +15 slots (`slot-003`…`slot-017`), one per new airing show, **spread across
    all 7 days** (Mon=2 Tue=2 Wed=3 Thu=2 Fri=2 Sat=3 Sun=3 — every weekday column populated) with
    varied JST times (00:00 / 00:30 / 01:00 / 08:30 / 09:30 / 10:00 / 12:00 / 16:00 / 17:30 /
    21:00 / 22:00 / 22:30 / 23:00 / 23:30), timezone `Asia/Tokyo`. The 2 existing slots kept.
  - **Seed LOW fixed:** `supabase/seed/seed.sql` TRUNCATE now explicitly lists
    `public.airing_slots` first (child-before-parent, no reliance on implicit cascade).
  - **search.ts deferred fixes (Task B, live-Supabase path only):** (1) genre filter rewritten as a
    robust two-step base-table query — `genres.select('id').in('slug', …)` then
    `show_genres.select('show_id').in('genre_id', …)` — replacing the `.in('genres.slug', …)`
    embedded filter; throws on error as before. (2) `shows` select now uses
    `select(SHOW_COLUMNS, { count: 'exact' })` and returns `total = count ?? shows.length`.
    Seed-fallback path untouched.
  - `next.config.ts`: confirmed `cdn.myanimelist.net` already allowlisted; no new host introduced.
  - **Validation:** `npm run typecheck` clean · `npm run build` OK (45 pages now, all **39 shows**
    SSG-prerendered, `/schedule` + `/search` build via seed-fallback).
  - **NEW totals after enrichment (for QA):** shows **24→39**; airing shows **2→17**; airing slots
    **2→17**; genres **11→12**. New slugs: witch-hat-atelier, classroom-of-the-elite-4th-season-
    second-year-first-semester, that-time-i-got-reincarnated-as-a-slime-season-4,
    daemons-of-the-shadow-realm, wistoria-wand-and-sword-season-2, dr-stone-science-future-part-3,
    the-angel-next-door-spoils-me-rotten-2, i-made-friends-with-the-second-prettiest-girl-in-my-class,
    gals-can-t-be-kind-to-otaku, the-warrior-princess-and-the-barbaric-king,
    welcome-to-demon-school-iruma-kun-season-4, farming-life-in-another-world-season-2,
    the-beginning-after-the-end-season-2, akane-banashi,
    ascendance-of-a-bookworm-adopted-daughter-of-an-archduke.
  - **QA HANDOFF — test assertions to reconcile (I did NOT touch tests):** `src/lib/data/search.test.ts`
    3 hardcoded counts now stale: line ~211 `status=airing` expect 2 → **17**; line ~250 `year=2026`
    expect 2 → **17**; line ~277 `year+audio (sub>0)` expect 2 → **17**. For reference: all 15 new
    shows are year 2026 with sub>0 and dub=0, so year=2026=17, year=2026&&dub>0=1, total shows=39,
    subEpisodes>0=39, dubEpisodes>0=21, genre 'action' count=16. `schedule.test.ts` self-adjusts
    (derives counts from the seed dynamically) — 9/9 still pass. No M1/M2 logic regressed.
- 2026-06-15 — qa-tester-m2-harden — Reconciled + HARDENED the test suite for the enriched seed
  (39 shows / 17 airing / 17 slots / 12 genres). **Only test code changed; no product code touched.**
  Final: `npm run test` **138/138 pass**; `npm run test:e2e` **30/30 pass** (both fully green).
  - **Fixed the 3 stale magic counts** in `src/lib/data/search.test.ts` flagged in the handoff —
    but made them ROBUST rather than swapping 2→17: `status=airing`, `year=2026`, and `year+audio`
    now derive the expected total from `SEED_SHOWS.filter(...)` AND assert a property on every
    result (`status==='airing'` / `year===2026` / `year===2026 && subEpisodes>0`). Genre `action`
    count is now seed-derived (was a stale "13 shows" comment); added `< SEED_TOTAL` bound to the
    dub case. Updated stale "24"/"21" comments. (search.test.ts was the only RED file: 3 failures.)
  - **Hardened the e2e specs** (`e2e/search.spec.ts`, `e2e/schedule.spec.ts`): both now
    `import seed from '../src/lib/data/seed.json'` and derive `SEED_TOTAL`/`SEED_AIRING`/`SEED_SUBBED`/
    `SEED_DUBBED`/slot facts at runtime. Replaced every hardcoded `24`/`2`: no-query default now
    asserts exactly `SEED_TOTAL` cards + "39 shows found"; `?audio=sub`→`SEED_SUBBED`; `?audio=dub`→
    `SEED_DUBBED` (and `<SEED_TOTAL`); `?status=airing`→`SEED_AIRING` count; genre/filter narrowing
    bounds use `<SEED_TOTAL`.
  - **New MULTI-WEEKDAY assertions (required):** unit — `schedule.test.ts` adds a test that
    `getWeeklySchedule()` returns entries spanning >1 distinct `dayOfWeek` and matching the seed's
    distinct slot days exactly (also re-checks 0..6 range). e2e — `schedule.spec.ts` adds a test that
    walks every `schedule-day` column, collects the `data-day` of columns containing a
    `schedule-entry`, and asserts the populated-day set is >1 and equals the seed's distinct days
    (currently all 7). Entry-count test is now seed-derived (`count % SEED_SLOT_COUNT === 0`).
  - **Coverage preserved:** ordering/default-sort/empty-result (search), TZ numeric conversion +
    day placement + empty-day "No releases" (ScheduleGrid unit, deterministic with `entries={[]}`),
    FilterPanel URL-sync (untouched — already synthetic), header search, randomizer, badges all
    still asserted. The e2e "No releases" check is now guarded to only fire when the seed leaves a
    weekday gap (it currently fills all 7), so the deterministic empty-state coverage lives in the
    unit test. FilterPanel.test.tsx, shows.test.ts, ShowCard/SubDub/Status/EpisodeList/Player tests
    needed no changes (already synthetic or seed-derived).
  - **Observation (LOW, unchanged, NOT a regression):** unknown-slug 404 still emits a one-off
    server-side `Internal: NoFallbackError` log (the documented `dynamicParams=false` artifact at
    `src/app/shows/[slug]/page.tsx`); the e2e unknown-slug test still asserts a correct 404. No
    product bug found during this pass.

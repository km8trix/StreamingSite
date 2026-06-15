# M3-CONTRACT.md — Milestone 3: Accounts → Comments → Forum

Companion to `COORDINATION.md` (read that first for env rules, conventions, gate, and the
M1/M2 data contract). This doc defines **Milestone 3**. Built in 3 staged features in order:
**auth → comments → forum** (comments + forum both depend on auth/profiles).

Branch: `feat/milestone-1-catalog`. M1 (`cd15b7e`) + M2 (`382d332`) committed; do not regress.

---

## Backend — LIVE local Supabase (NEW for M3)

A local Supabase stack now runs in Docker (set up by the lead):
- API URL `http://127.0.0.1:54321`, Studio `http://127.0.0.1:54323`, Postgres on `54322`.
- Keys are in **`.env.local`** (gitignored): `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- **The app now runs the LIVE Supabase path** (`isSupabaseConfigured()` is true at runtime),
  not seed-fallback. M1/M2 read queries now hit real Postgres seeded from `supabase/seed/seed.sql`.
- Apply schema/seed changes with: `npx supabase db reset` (re-runs all migrations + seed).
  Apply only new migrations with `npx supabase migration up`. Get keys with
  `npx supabase status`. **Config (`supabase/config.toml`) changes require**
  `npx supabase stop && npx supabase start` to take effect.
- Network/Docker commands need the sandbox-disable Bash option.

**Migrations numbering:** 0001 (init), 0002 (airing_slots) exist. M3 adds **0003** (auth/profiles),
**0004** (comments), **0005** (forum). Keep them idempotent-friendly and RLS-first.

**Auth config (local dev):** in `supabase/config.toml` set `[auth.email] enable_confirmations = false`
so email/password signup is immediately usable without SMTP (then restart the stack). This makes
signup→signed-in instant for dev + e2e.

---

## Conventions for M3 (in addition to COORDINATION.md)

- **Auth via `@supabase/ssr`**: browser client for client components; server client (already in
  `src/lib/supabase/server.ts`) reads cookies; add **`middleware.ts`** to refresh the session on
  every request (the standard `@supabase/ssr` `updateSession` pattern).
- **Mutations via Server Actions** (`'use server'`) or Route Handlers — never expose the service
  role key to the client. The `SUPABASE_SERVICE_ROLE_KEY` is server-only.
- **RLS on every new table** — default deny; explicit policies. Auth-gated writes check
  `auth.uid()`. Public read where content is public (comments, forum posts).
- Reuse existing UI primitives/theme. Keep Server Components default; `'use client'` only for
  interactive forms/menus.
- Add `data-testid`s for QA on every new interactive element.

---

## Feature 1 — AUTH (migration 0003) — DO FIRST

**DB / data layer:**
- `profiles` table: `id uuid pk references auth.users(id) on delete cascade`, `username text unique`,
  `display_name text`, `avatar_url text`, `role text default 'user' check (role in ('user','moderator','admin'))`,
  `created_at timestamptz default now()`, `updated_at timestamptz default now()`.
- Trigger `on auth.users insert` → `handle_new_user()` creates a `profiles` row (username from
  email local-part or metadata, deduped).
- RLS: profiles **public SELECT** (display names/avatars are public); **UPDATE only own row**
  (`auth.uid() = id`); no client INSERT/DELETE (trigger handles insert).
- Data helpers in `src/lib/data/profiles.ts`: `getCurrentUser()` (server, returns the session
  user + profile or null), `getProfile(userId)`, `updateProfile(...)` (server action).
- Auth server actions in `src/lib/auth/actions.ts`: `signUp(email,password,username)`,
  `signIn(email,password)`, `signOut()` — using the server Supabase client; return typed
  `{ error?: string }`; revalidate + redirect appropriately.

**UI:**
- `middleware.ts` (repo root or src) — `@supabase/ssr` session refresh.
- `/signin` and `/signup` pages with accessible forms (email, password, +username on signup),
  inline error display, link between them. Use the server actions.
- Header: when signed-out show "Sign in"; when signed-in show avatar/username + a menu with
  "Profile" and "Sign out". (Update `SiteHeader`.)
- `/profile` page (own profile; edit display name + avatar URL). Optional `/u/[username]` public view.
- Auth-state must be reflected server-side (read session in layout/header server component).

**Testids:** `signin-form`, `signup-form`, `email-input`, `password-input`, `username-input`,
`auth-submit`, `auth-error`, `header-user-menu`, `signout-button`, `signin-link`.

---

## Feature 2 — COMMENTS (migration 0004) — after auth

**DB:** `comments` table: `id uuid pk default gen_random_uuid()`, `show_id text references shows(id)
on delete cascade`, `user_id uuid references profiles(id) on delete cascade`, `parent_id uuid
references comments(id) on delete cascade` (null = top-level; one level of threading is enough),
`body text not null check (char_length(body) between 1 and 4000)`, `is_edited boolean default false`,
`is_deleted boolean default false`, `created_at timestamptz default now()`, `updated_at`.
- RLS: **public SELECT** (read comments without auth); **INSERT** only `auth.uid() = user_id`;
  **UPDATE/DELETE** only own row (soft-delete preferred — set `is_deleted`, blank the body in UI).
- Indexes on `show_id`, `parent_id`, `created_at`.

**Data/actions** `src/lib/data/comments.ts`: `getComments(showId)` (threaded, joins profile
display_name/avatar), server actions `addComment(showId,body,parentId?)`, `editComment(id,body)`,
`deleteComment(id)` (soft). Enforce auth in actions.

**UI:** a `CommentsSection` on `/shows/[slug]`: list (newest first, replies nested one level),
a composer (auth-gated — prompt to sign in if logged out), reply/edit/delete affordances on own
comments, relative timestamps, optimistic or revalidate-on-action. Testids: `comments-section`,
`comment-item`, `comment-body`, `comment-composer`, `comment-submit`, `comment-reply`,
`comment-edit`, `comment-delete`, `comments-signin-prompt`.

---

## Feature 3 — FORUM (migration 0005) — after auth

**DB:**
- `forum_categories` (`id text pk`, `name`, `slug unique`, `description`, `sort_order int`).
- `forum_threads` (`id uuid pk`, `category_id text fk`, `user_id uuid fk profiles`, `title`,
  `slug`, `is_pinned bool`, `is_locked bool`, `created_at`, `last_activity_at timestamptz`,
  `optional show_id text fk shows null`).
- `forum_posts` (`id uuid pk`, `thread_id uuid fk`, `user_id uuid fk profiles`, `body text`,
  `created_at`, `updated_at`, `is_deleted bool`).
- RLS: categories/threads/posts **public SELECT**; threads/posts INSERT only own
  (`auth.uid()=user_id`); UPDATE/DELETE own; moderators (role) may pin/lock/delete (policy via a
  `is_moderator()` helper checking the caller's profile role). Update `last_activity_at` on new post
  (trigger or in the action).
- **Seed ~4 categories** (e.g. General, Seasonal Anime, Recommendations, Site Feedback) in a new
  `supabase/seed/forum_seed.sql` and wire it into config seed paths (or append to seed.sql).

**Data/actions** `src/lib/data/forum.ts`: `listCategories()`, `getCategory(slug)`,
`listThreads(categoryId)` (sorted pinned-first then last_activity desc), `getThread(id)` with posts,
server actions `createThread(categoryId,title,body)`, `replyToThread(threadId,body)`,
moderator actions `pinThread`/`lockThread`/`deletePost`.

**UI:** `/forum` (category list w/ thread counts), `/forum/[category]` (thread list + "New thread"
auth-gated), `/forum/thread/[id]` (posts + reply composer auth-gated, lock state respected). Add a
"Forum" nav link. Testids: `forum-categories`, `category-card`, `thread-list`, `thread-row`,
`new-thread-button`, `new-thread-form`, `thread-posts`, `post-item`, `reply-composer`, `reply-submit`.

---

## Testing strategy (M3)
- **Unit (Vitest):** mock `@supabase/ssr` / the server client; test data-layer mappers, action
  validation (empty body rejected, auth required), RLS-intent at the logic level, threading shape.
- **E2E (Playwright, against LIVE local Supabase):** sign up a fresh user (random email per run via
  the test, since signup persists) → signed-in state in header → post a comment on a show → see it
  → create a forum thread → reply. Reset DB state between runs as needed (`supabase db reset`) or use
  unique emails. Document any reset requirement.
- Keep M1/M2 suites green (now running against live Supabase for read paths).

## Per-feature flow (each is its own workflow): DB → UI → adversarial review → QA, lead verifies + commits.

## Status log (append: `YYYY-MM-DD — agent — what changed`)
- 2026-06-15 — lead — Created this M3 contract; standing up local Supabase (Docker) backend.

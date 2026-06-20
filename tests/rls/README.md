# RLS test suite

These tests verify the database's **Row-Level Security** posture end-to-end
against a **real local Supabase** — RLS is enforced by Postgres and cannot be
mocked. They are intentionally **not** part of `npm test` (which stays DB-free
and fast); run them on demand.

## Run

```bash
npm run db:start     # supabase start — boots Postgres + applies the 12 migrations + seed
npm run db:reset     # optional: re-apply migrations + seed from scratch for a clean slate
npm run test:rls     # vitest run --config vitest.rls.config.ts
```

Credentials resolve automatically from the local Supabase CLI
(`supabase status -o env`), or from env vars if you set them
(`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`SUPABASE_DB_URL`) — handy for CI.

## How it works

Three connection tiers (`_helpers.ts`):

- **anon / authenticated clients** (`@supabase/supabase-js`) — exercise RLS as a
  real client would. The authenticated client is a freshly-created confirmed
  user signed in with a password, so `auth.uid()` is that user.
- **superuser SQL** (`pg`, the `postgres` role) — used only for setup, role
  elevation, and raw cross-RLS verification. This is necessary because the
  project deliberately grants **`service_role` no table DML** (only
  `anon`/`authenticated` get grants), so even a leaked service key can't read
  user data via PostgREST — a property the suite relies on rather than works
  around.

Files run **sequentially** (`fileParallelism: false`) over one shared database.
Each file creates its own users and deletes them in `afterAll`, which cascades
to their profiles + owned rows.

## Coverage

| File | Asserts |
|---|---|
| `watchlist` / `watch-progress` | private per-user tables: owner-only read, cross-user isolation, anon denied, no direct write, RPC pins `user_id`, input validation |
| `comments` | public read, authored writes, forged-author rejected, one-way soft-delete ratchet |
| `forum` | thread ownership, author can't pin/lock, moderator escalation, locked-thread posting blocked for non-mods |
| `profiles` | auto-created on signup, update-own-only, **no self-promotion** (`role` not writable) |
| `show-view-events` | fully private log (no table access), guest + signed-in RPC writes, aggregate-only reads |
| `catalog-and-ads` | catalog public-read + write-locked, ads hidden unless `is_active`, counter RPCs touch active ads only |

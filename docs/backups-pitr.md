# Database backups & Point-in-Time Recovery (PITR) — runbook

Scope: the **Supabase Postgres database** behind production (catalog, auth users,
profiles, comments, forum, watchlists, watch progress, ad counters). This is the
only stateful system — everything else (the Next.js app on Vercel) is rebuilt
from git, and the schema itself is reproducible from `supabase/migrations/` +
`supabase/seed/`.

> Most of this is **dashboard configuration on the production Supabase project**.
> There is no app code to change. Plan tiers and retention numbers change over
> time — treat the specifics below as a starting point and confirm them in your
> project's **Database → Backups** page.

---

## 1. What protects the data

| Layer | Mechanism | Status |
|---|---|---|
| Schema | `supabase/migrations/*.sql` in git (12 migrations) | ✅ versioned, reproducible |
| Reference data | `supabase/seed/seed.sql` (regenerable via `node scripts/build_seed.mjs`) | ✅ in git |
| Daily snapshots | Supabase **automated daily backups** (Pro plan, ~7-day retention) | ⛳ enable/verify |
| Granular recovery | Supabase **PITR add-on** (restore to any second within the retention window) | ⛳ enable |
| Data-integrity rules | RLS policies + SECURITY DEFINER RPCs, covered by `npm run test:rls` | ✅ tested (this PR) |

Daily backups give you "yesterday's database." **PITR** is what lets you recover
to *just before* a bad migration, an accidental mass-delete, or a compromised
write — restore to e.g. `12:04:58Z`, not just "the start of the day."

## 2. Enable daily backups + PITR (one-time)

1. Supabase dashboard → your **production** project → **Database → Backups**.
2. Confirm **daily backups** are on (automatic on paid plans). Note the
   retention window shown.
3. Enable the **Point-in-Time Recovery** add-on (requires the Pro plan; it's a
   paid add-on). Choose a retention window (7 days is the usual minimum; pick
   longer if you want more runway to notice corruption).
4. After enabling, the Backups page shows the **earliest restorable timestamp**.
   PITR works forward from when you turned it on — it cannot recover a point
   before that, so enable it *before* you need it.

What's included: the entire Postgres cluster, including the `auth` schema (users
/ sessions) and `public` app tables. **Not** included: Supabase Storage objects
(backed up separately) and anything outside Postgres. This project currently
stores no user uploads in Storage, so the database backup is the whole picture.

## 3. Recovery procedures

### 3a. Restore to a point in time (PITR)
1. **Stop the bleeding first.** If it's an active bad actor or a runaway job,
   pause writes — e.g. flip the site to maintenance / disable the offending
   path — so you're restoring to a stable target.
2. Dashboard → **Database → Backups → Point in Time** → pick the timestamp just
   **before** the incident.
3. Confirm. Supabase provisions the restore. **This overwrites the database in
   place** — there is data loss between the chosen point and now, by definition.
4. After restore: re-run smoke checks (below) and re-deploy the app if needed so
   it reconnects.

### 3b. Restore a daily snapshot
Dashboard → **Database → Backups → Scheduled backups** → choose a day → restore.
Same overwrite semantics; coarser granularity than PITR.

### 3c. Worst case — rebuild from git
If backups are unavailable, the schema is still fully reproducible:
```bash
# against a fresh Postgres / new Supabase project
supabase db push                 # apply supabase/migrations/*
psql "$DATABASE_URL" -f supabase/seed/seed.sql   # reference/catalog data
```
This recovers **structure + seed catalog** but **not** user-generated data
(accounts, comments, watchlists). That's why 3a/3b exist.

## 4. Post-restore smoke checks
- Site loads; a show detail page renders (catalog intact).
- Sign in works; a known user's watchlist / continue-watching is present.
- `npm run test:rls` against a clone of the restored DB still passes (RLS intact).
- Spot-check row counts vs. expectations: `select count(*) from public.profiles;`
  `select count(*) from public.comments;`

## 5. Operating cadence
- **Quarterly restore drill.** Restore the latest backup into a *throwaway*
  Supabase project and run the smoke checks. An untested backup is a hope, not a
  backup.
- **Before risky migrations.** Note the current timestamp so you have an exact
  PITR target if the migration goes wrong.
- **Review retention** as the user base grows — longer window = more time to
  detect silent corruption.

## 6. Operator checklist
- [ ] Daily backups confirmed on (Database → Backups).
- [ ] PITR add-on enabled; retention window chosen; earliest-restore timestamp noted.
- [ ] This runbook's recovery steps validated once via a restore drill.
- [ ] Calendar reminder set for the quarterly drill.

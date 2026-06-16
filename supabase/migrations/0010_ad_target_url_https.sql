-- 0010_ad_target_url_https.sql — Constrain ad URLs to http(s) schemes.
--
-- Defense-in-depth for the ad system (0007_ads.sql). `ad_placements.target_url`
-- is rendered into a clickable <Link href> and `image_url` into <Image src> for
-- every visitor on every page that has a slot. Ads are managed out-of-band by the
-- service role (which BYPASSES RLS), so the app-layer never validates these URLs
-- and the only guard is at write time. Without a constraint, a service-role (or
-- compromised-credential) insert of `javascript:…` / `data:…` would be stored and
-- served as a live link/asset — a stored-XSS vector.
--
-- The seed and any real creative use absolute https URLs (e.g. placehold.co), so
-- existing rows already satisfy this. Enforce it at the DB so no future write —
-- by any role, including service_role — can introduce a non-http(s) scheme.
--
-- Idempotent: Postgres has no `ADD CONSTRAINT IF NOT EXISTS`, so guard via a DO
-- block that checks pg_constraint (mirrors the 0007 "if not exists" discipline).

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.ad_placements'::regclass
      and conname = 'ad_placements_target_url_http'
  ) then
    alter table public.ad_placements
      add constraint ad_placements_target_url_http
      check (target_url ~* '^https?://');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.ad_placements'::regclass
      and conname = 'ad_placements_image_url_http'
  ) then
    alter table public.ad_placements
      add constraint ad_placements_image_url_http
      check (image_url ~* '^https?://');
  end if;
end $$;

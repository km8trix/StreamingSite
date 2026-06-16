-- 0010_ad_target_url_https.sql — Guard ad URLs against dangerous schemes.
--
-- Defense-in-depth for the ad system (0007_ads.sql). `target_url` is rendered
-- into a clickable <Link href> and `image_url` into <Image src> for every
-- visitor on every page that has a slot. Ads are managed out-of-band by the
-- service role (which BYPASSES RLS), so the app-layer never validates these URLs
-- and the only guard is at write time. Without a constraint, a service-role (or
-- compromised-credential) insert of `javascript:…` / `data:…` would be stored
-- and served as a live link/asset — a stored-XSS vector.
--
-- target_url: the HOUSE ads legitimately point at SAME-ORIGIN in-app routes
-- (/forum, /random, /signup, /schedule), so a root-relative path is allowed in
-- addition to absolute http(s). We still reject script/data schemes (which have
-- no leading '/' or http) AND protocol-relative `//` or `/\` (which escape the
-- origin). So: absolute http(s) OR a single '/' followed by end-of-string or a
-- char that is neither '/' nor '\'.
--
-- image_url: always an absolute http(s) asset URL (rendered via next/image), so
-- it stays strict.
--
-- Idempotent: Postgres has no `ADD CONSTRAINT IF NOT EXISTS`, so guard via a DO
-- block that checks pg_constraint (mirrors the 0007 "if not exists" discipline).

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.ad_placements'::regclass
      and conname = 'ad_placements_target_url_scheme'
  ) then
    alter table public.ad_placements
      add constraint ad_placements_target_url_scheme
      check (
        target_url ~ '^https?://'
        or target_url ~ '^/($|[^/\\])'
      );
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

-- 0007_ads.sql — Non-invasive advertising placements (Roadmap: ad slots).
--
-- ONE table: public.ad_placements. Each row is a single creative bound to a
-- named SLOT (`placement_key`, e.g. home-banner / grid-native / sidebar). The UI
-- asks the data layer for ONE active ad for a slot (weighted random) and renders
-- it in a reserved, clearly-"Sponsored"-labelled, fixed-height in-flow box. No
-- pop-ups / interstitials / autoplay / layout shift — the DB only stores the
-- creative + counters; invasiveness is a UI concern and is enforced there.
--
-- SECURITY MODEL — apply the hard-won M3 auth/comments/forum lessons:
--
--  (1) Public read is ACTIVE-ONLY. RLS SELECT policy USING (is_active) for anon +
--      authenticated, so inactive / unsold / paused creatives are NEVER exposed to
--      a client — not via the data layer, not via a raw PostgREST query. The
--      service role bypasses RLS for out-of-band admin/management.
--  (2) NO client INSERT / UPDATE / DELETE. There is no write policy and no write
--      GRANT for anon/authenticated, so ads are managed entirely out-of-band
--      (service role / admin). A client can never create an ad, flip is_active,
--      change the image/target, or re-weight a slot.
--  (3) The ONLY mutation a client may perform is +1 on the impression/click
--      counter of a NAMED, ACTIVE ad — and ONLY through the two SECURITY DEFINER
--      RPCs below (record_ad_impression / record_ad_click). Those functions run
--      with the definer's rights (so they can update a table the caller has no
--      write grant on), but their body is constrained to a single
--      `set counter = counter + 1 where id = p_id and is_active`. A caller cannot
--      use them to set image/target/active/weight or to write an arbitrary row.
--      Both pin `search_path` to '' and schema-qualify every reference so they can
--      never be hijacked through a caller-controlled search path.

-- ===========================================================================
-- ad_placements
-- ===========================================================================
create table if not exists public.ad_placements (
  id            text primary key,
  -- Which slot this creative belongs to (e.g. 'home-banner', 'grid-native',
  -- 'sidebar'). A slot may have several active ads; the data layer picks one by
  -- weighted random per request.
  placement_key text not null,
  name          text,
  image_url     text not null,
  target_url    text not null,
  alt_text      text,
  -- Relative selection weight within a slot (higher = shown more often). Must be
  -- positive so an active ad is always selectable.
  weight        integer not null default 1 check (weight > 0),
  is_active     boolean not null default true,
  -- Counters. bigint so a popular slot never overflows. Only ever incremented by
  -- the two SECURITY DEFINER RPCs below.
  impressions   bigint not null default 0,
  clicks        bigint not null default 0,
  created_at    timestamptz not null default now()
);

-- Index for the hot read path: fetch the ACTIVE ads for a given slot.
create index if not exists ad_placements_key_active_idx
  on public.ad_placements (placement_key, is_active);

-- ===========================================================================
-- Row Level Security — public read of ACTIVE ads ONLY; no client writes
-- ===========================================================================
alter table public.ad_placements enable row level security;

drop policy if exists "Public read active ads" on public.ad_placements;

-- SELECT only where is_active. anon + authenticated see only live creatives;
-- inactive/unsold ads are invisible to every client (the service role bypasses
-- RLS for admin). There are intentionally NO insert/update/delete policies, so
-- those operations are denied for anon/authenticated regardless of any grant.
create policy "Public read active ads"
  on public.ad_placements for select
  to anon, authenticated
  using (is_active);

-- ===========================================================================
-- Table privileges — SELECT only for anon/authenticated (NO write grant)
-- ===========================================================================
grant usage on schema public to anon, authenticated; -- already granted; harmless re-grant
grant select on public.ad_placements to anon, authenticated;
-- NO grant insert/update/delete: ads are managed out-of-band by the service role.

-- ===========================================================================
-- Tracking RPCs (SECURITY DEFINER) — the ONLY client-reachable mutation
-- ===========================================================================
-- These let a client increment ONE counter on ONE active ad without holding any
-- write grant on ad_placements. They run as the function owner (definer), so the
-- UPDATE succeeds despite the caller having SELECT-only access. The body is the
-- whole permission boundary: a single `+ 1` on the named, ACTIVE row — nothing
-- else is writable through them. `search_path` is pinned to '' and every name is
-- schema-qualified so the function can never resolve objects via a
-- caller-controlled path.

-- record_ad_impression(p_id) — +1 impressions on the active ad p_id (no-op if the
-- id is unknown or the ad is inactive).
create or replace function public.record_ad_impression(p_id text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.ad_placements
     set impressions = impressions + 1
   where id = p_id
     and is_active is true;
$$;

-- record_ad_click(p_id) — +1 clicks on the active ad p_id (no-op if unknown or
-- inactive).
create or replace function public.record_ad_click(p_id text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.ad_placements
     set clicks = clicks + 1
   where id = p_id
     and is_active is true;
$$;

-- Lock down then grant EXECUTE explicitly. Revoke from PUBLIC first so the only
-- principals who can call these are the two we name.
revoke all on function public.record_ad_impression(text) from public;
revoke all on function public.record_ad_click(text)      from public;
grant execute on function public.record_ad_impression(text) to anon, authenticated;
grant execute on function public.record_ad_click(text)      to anon, authenticated;

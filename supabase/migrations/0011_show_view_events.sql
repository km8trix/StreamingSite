-- 0011_show_view_events.sql — "Top Anime of the Day/Week/Month" engagement log.
--
-- A time-stamped, append-only event log of show views (ALL viewers — signed-in
-- AND guests), so the home page can rank shows by REAL engagement over rolling
-- Day/Week/Month windows. The current watch_progress table keeps only one row
-- per (user, show) and is overwritten, so it can't give rolling counts — hence a
-- dedicated events table.
--
-- ACCESS MODEL:
--   - show_view_events is PRIVATE: RLS is on with NO client policies and NO table
--     grants, so anon/authenticated cannot read or write rows directly (the raw
--     who-watched-what log never leaks). It is touched ONLY by the two SECURITY
--     DEFINER functions below, which run as the table owner and bypass RLS.
--   - record_show_view(show_id): the write path, granted to anon + authenticated
--     so guests count too. To blunt inflation it (a) ignores unknown shows and
--     (b) rate-limits signed-in users to one counted view per show per hour.
--     Guests (no auth) can't be deduped server-side; the client fires once per
--     show per session to limit casual spam. NOTE: as an anon-writable counter on
--     a public site this is still inherently abusable by a determined attacker —
--     accepted trade-off for representative (guest-inclusive) rankings.
--   - get_top_anime(since, limit): the read path, granted to anon + authenticated,
--     aggregates counts across ALL events in the window (bypassing RLS as definer)
--     and returns ranked show summaries.

-- show_view_events ----------------------------------------------------------
create table if not exists public.show_view_events (
  id          bigint generated always as identity primary key,
  show_id     text not null references public.shows (id)    on delete cascade,
  -- null for guests; set null (not cascade-delete) so a deleted account doesn't
  -- erase the historical engagement it generated.
  user_id     uuid references public.profiles (id)          on delete set null,
  occurred_at timestamptz not null default now(),
  -- Clock-hour bucket used to dedup signed-in views ATOMICALLY (see the partial
  -- unique index below). Defaulted at insert; clients never set it.
  view_hour   timestamptz not null default date_trunc('hour', now())
);

-- Windowed aggregation scans by time then groups by show.
create index if not exists show_view_events_time_idx
  on public.show_view_events (occurred_at);

-- Enforce "at most one counted view per signed-in user per show per clock hour"
-- at the STORAGE layer so it's RACE-FREE: record_show_view inserts with ON
-- CONFLICT DO NOTHING against this partial unique index (a read-then-write check
-- would let two concurrent inserts both pass). Guests (user_id null) are excluded
-- from the index — they are deduped client-side (once per session), not here.
create unique index if not exists show_view_events_user_hour_uniq
  on public.show_view_events (user_id, show_id, view_hour)
  where user_id is not null;

-- Write path ----------------------------------------------------------------
create or replace function public.record_show_view(p_show_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  -- Fire-and-forget telemetry: never raise. Ignore unknown shows.
  if not exists (select 1 from public.shows s where s.id = p_show_id) then
    return;
  end if;

  -- Atomic per-clock-hour dedup for signed-in users via the partial unique index
  -- (race-free, unlike a read-then-write check). Guests (uid null) aren't in the
  -- index, so they always insert; the client dedups them once per session.
  insert into public.show_view_events (show_id, user_id)
  values (p_show_id, uid)
  on conflict (user_id, show_id, view_hour) where user_id is not null
  do nothing;
end;
$$;

-- Read path: ranked shows by engagement within [p_since, now] -----------------
create or replace function public.get_top_anime(
  p_since timestamptz,
  p_limit integer default 12
)
returns table (
  id            text,
  slug          text,
  title         text,
  cover_image   text,
  sub_episodes  integer,
  dub_episodes  integer,
  status        text,
  year          integer,
  views         bigint
)
language sql
security definer
set search_path = ''
as $$
  select s.id, s.slug, s.title, s.cover_image,
         s.sub_episodes, s.dub_episodes, s.status, s.year,
         count(v.id) as views
  from public.show_view_events v
  join public.shows s on s.id = v.show_id
  where v.occurred_at >= p_since
  group by s.id
  order by views desc, s.popularity_score desc
  limit greatest(1, least(coalesce(p_limit, 12), 50));
$$;

-- Row Level Security: on, with NO policies => no direct client row access. The
-- SECURITY DEFINER functions are the only path.
alter table public.show_view_events enable row level security;

-- No table grants to anon/authenticated (the functions run as owner). Only the
-- function EXECUTE privileges are exposed to clients.
grant execute on function public.record_show_view(text) to anon, authenticated;
grant execute on function public.get_top_anime(timestamptz, integer)
  to anon, authenticated;

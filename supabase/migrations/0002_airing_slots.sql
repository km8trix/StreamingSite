-- 0002_airing_slots.sql — Release schedule table (Milestone 2, Phase 4).
-- Tracks one weekly air slot per currently-airing show.
-- RLS: public (anon + authenticated) SELECT only — no write policies (matches 0001 style).

-- airing_slots -------------------------------------------------------------
create table if not exists public.airing_slots (
  id           text primary key,
  show_id      text not null references public.shows (id) on delete cascade,
  day_of_week  smallint not null check (day_of_week >= 0 and day_of_week <= 6),
                                  -- 0=Monday … 6=Sunday (ISO week convention)
  air_time     text not null,     -- 'HH:MM' 24-hour JST (source timezone)
  timezone     text not null default 'Asia/Tokyo',
  season       text not null default ''
);

-- Indexes -------------------------------------------------------------------
create index if not exists airing_slots_show_idx on public.airing_slots (show_id);
create index if not exists airing_slots_day_idx  on public.airing_slots (day_of_week);

-- Row Level Security --------------------------------------------------------
alter table public.airing_slots enable row level security;

drop policy if exists "Public read airing_slots" on public.airing_slots;

create policy "Public read airing_slots"
  on public.airing_slots for select
  to anon, authenticated
  using (true);

-- Table privileges (RLS governs rows; GRANT governs table access — need both).
grant select on public.airing_slots to anon, authenticated;

-- 0001_init.sql — Anime streaming catalog schema (Milestone 1).
-- Tables: genres, shows, show_genres (join), episodes.
-- Row Level Security ON with public (anon) read on all four tables —
-- the catalog is public; there is no write path from the app in M1.
--
-- IDs are text (slug-style, e.g. 'show-001') to stay consistent with the
-- bundled seed.json used by the offline fallback in src/lib/data/*.

-- Extensions ---------------------------------------------------------------
-- (none required; we use text ids, not uuid generation)

-- updated_at trigger function ---------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- enum-like check is enforced via CHECK constraint (keeps it simple/portable)

-- genres -------------------------------------------------------------------
create table if not exists public.genres (
  id    text primary key,
  name  text not null,
  slug  text not null
);

create unique index if not exists genres_slug_key on public.genres (slug);

-- shows --------------------------------------------------------------------
create table if not exists public.shows (
  id                text primary key,
  slug              text not null,
  title             text not null,
  cover_image       text not null,
  banner_image      text,
  synopsis          text not null default '',
  sub_episodes      integer not null default 0 check (sub_episodes >= 0),
  dub_episodes      integer not null default 0 check (dub_episodes >= 0),
  status            text not null default 'finished'
                      check (status in ('airing', 'finished', 'upcoming')),
  year              integer,
  popularity_score  integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create unique index if not exists shows_slug_key       on public.shows (slug);
create index        if not exists shows_popularity_idx on public.shows (popularity_score desc);
create index        if not exists shows_updated_at_idx on public.shows (updated_at desc);
create index        if not exists shows_status_idx     on public.shows (status);

drop trigger if exists shows_set_updated_at on public.shows;
create trigger shows_set_updated_at
  before update on public.shows
  for each row execute function public.set_updated_at();

-- show_genres (many-to-many) ----------------------------------------------
create table if not exists public.show_genres (
  show_id   text not null references public.shows (id)  on delete cascade,
  genre_id  text not null references public.genres (id) on delete cascade,
  primary key (show_id, genre_id)
);

create index if not exists show_genres_genre_idx on public.show_genres (genre_id);

-- episodes -----------------------------------------------------------------
create table if not exists public.episodes (
  id         text primary key,
  show_id    text not null references public.shows (id) on delete cascade,
  number     integer not null check (number >= 0),
  title      text not null default '',
  is_subbed  boolean not null default false,
  is_dubbed  boolean not null default false,
  air_date   date,
  unique (show_id, number)
);

create index if not exists episodes_show_idx on public.episodes (show_id, number);

-- Row Level Security: public read on the whole catalog --------------------
alter table public.genres       enable row level security;
alter table public.shows        enable row level security;
alter table public.show_genres  enable row level security;
alter table public.episodes     enable row level security;

-- Public SELECT policies (anon + authenticated). No write policies exist,
-- so inserts/updates/deletes are blocked for everyone except the service role
-- (which bypasses RLS) — i.e. seeding/admin happens out-of-band.
drop policy if exists "Public read genres"      on public.genres;
drop policy if exists "Public read shows"       on public.shows;
drop policy if exists "Public read show_genres" on public.show_genres;
drop policy if exists "Public read episodes"    on public.episodes;

create policy "Public read genres"
  on public.genres for select
  to anon, authenticated
  using (true);

create policy "Public read shows"
  on public.shows for select
  to anon, authenticated
  using (true);

create policy "Public read show_genres"
  on public.show_genres for select
  to anon, authenticated
  using (true);

create policy "Public read episodes"
  on public.episodes for select
  to anon, authenticated
  using (true);

-- Table privileges ---------------------------------------------------------
-- RLS (above) controls WHICH ROWS are visible; GRANT controls whether the role
-- may touch the table at all. PostgREST (anon/authenticated) needs BOTH —
-- without these grants, reads fail with "permission denied for table ...".
grant usage on schema public to anon, authenticated;
grant select on public.genres, public.shows, public.show_genres, public.episodes
  to anon, authenticated;

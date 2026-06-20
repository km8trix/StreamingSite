-- 0012_watchlist.sql — "My List" watchlist (signed-in users).
--
-- One row per (user, show): a show the user has explicitly SAVED to watch.
-- Distinct from watch_progress (0009, "current resume point") — a watchlist
-- entry carries no progress and persists until the user removes it. The home
-- "My List" rail lists these newest-first.
--
-- Guests (no account) keep their list in localStorage; on sign-in the client
-- flushes those entries through add_to_watchlist() (the login-merge path),
-- exactly like Continue Watching.
--
-- SECURITY model (consistent with 0009 watch_progress):
--   - watchlist is PRIVATE: RLS restricts every row op to the owner
--     (auth.uid() = user_id); anon has NO access at all.
--   - WRITES go ONLY through the SECURITY DEFINER add_to_watchlist() RPC, which
--     pins user_id = auth.uid() and validates the show exists, so a client can
--     neither save for another user nor store a dangling reference. We grant NO
--     insert/update on the table to clients (only select + delete-own, the
--     latter so the UI can remove a saved show).

-- watchlist -----------------------------------------------------------------
create table if not exists public.watchlist (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  show_id     text not null references public.shows (id)    on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, show_id)
);

-- List a user's saved shows for the rail, newest-first.
create index if not exists watchlist_user_recent_idx
  on public.watchlist (user_id, created_at desc);

-- Write path: save a show (idempotent). Pins user_id = auth.uid() and validates
-- the show exists so we never persist a dangling reference.
create or replace function public.add_to_watchlist(p_show_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  if not exists (select 1 from public.shows s where s.id = p_show_id) then
    raise exception 'unknown show %', p_show_id;
  end if;

  insert into public.watchlist (user_id, show_id)
  values (uid, p_show_id)
  on conflict (user_id, show_id) do nothing;
end;
$$;

-- Row Level Security --------------------------------------------------------
alter table public.watchlist enable row level security;

drop policy if exists "Users read own watchlist"   on public.watchlist;
drop policy if exists "Users delete own watchlist" on public.watchlist;

-- SELECT only your own rows (private list; no anon, no cross-user reads).
create policy "Users read own watchlist"
  on public.watchlist for select
  to authenticated
  using (auth.uid() = user_id);

-- DELETE only your own rows (remove a saved show from the rail).
create policy "Users delete own watchlist"
  on public.watchlist for delete
  to authenticated
  using (auth.uid() = user_id);

-- No INSERT/UPDATE policies: clients cannot write the table directly; the
-- SECURITY DEFINER add_to_watchlist() RPC is the only write path.

-- Table privileges (RLS governs rows; GRANT governs table access — need BOTH).
grant usage on schema public to authenticated;   -- already granted; harmless re-grant
grant select, delete on public.watchlist to authenticated;
-- Note: deliberately NO grant to anon, and NO insert/update grant to anyone.

-- The write RPC is the only mutation surface exposed to clients.
grant execute on function public.add_to_watchlist(text) to authenticated;

-- 0009_watch_progress.sql — "Continue Watching" progress (signed-in users).
--
-- One row per (user, show) holding the user's CURRENT resume point: which
-- episode they're on and how far in. We keep per-SHOW (not per-episode) state
-- because the home rail shows exactly one card per show, and advancement to the
-- next episode is resolved at WRITE time (see record_watch_progress) so reads
-- stay trivial — just "list my rows, newest first".
--
-- Guests (no account) never touch this table; their progress lives in
-- localStorage on the client. On sign-in the client flushes those guest entries
-- through record_watch_progress (the login-merge path).
--
-- SECURITY model (consistent with 0004 comments):
--   - watch_progress is PRIVATE: RLS restricts every row op to the owner
--     (auth.uid() = user_id); anon has NO access at all.
--   - WRITES go ONLY through the SECURITY DEFINER record_watch_progress() RPC,
--     which pins user_id = auth.uid() and validates the episode↔show link, so a
--     client can neither write progress for another user nor re-key a row. We
--     therefore grant NO insert/update on the table to clients (only select +
--     delete-own, the latter so the UI can dismiss a card).

-- watch_progress -----------------------------------------------------------
create table if not exists public.watch_progress (
  user_id           uuid not null references public.profiles (id)  on delete cascade,
  show_id           text not null references public.shows (id)     on delete cascade,
  episode_id        text not null references public.episodes (id)  on delete cascade,
  position_seconds  integer not null default 0 check (position_seconds >= 0),
  duration_seconds  integer not null default 0 check (duration_seconds >= 0),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  primary key (user_id, show_id)
);

-- Fetch a user's most-recently-watched shows for the rail.
create index if not exists watch_progress_user_recent_idx
  on public.watch_progress (user_id, updated_at desc);

-- updated_at trigger (reuse the shared helper from 0001). record_watch_progress
-- also sets updated_at explicitly; the trigger covers any direct UPDATE path.
drop trigger if exists watch_progress_set_updated_at on public.watch_progress;
create trigger watch_progress_set_updated_at
  before update on public.watch_progress
  for each row execute function public.set_updated_at();

-- Write path: upsert progress, advancing to the next episode at >=90% ---------
-- The "finished -> advance to next episode, or drop the show if it was the last"
-- rule lives here so it is enforced identically for every caller and the rail
-- never has to resolve episode lists at read time.
create or replace function public.record_watch_progress(
  p_show_id          text,
  p_episode_id       text,
  p_position_seconds integer,
  p_duration_seconds integer
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid        uuid := auth.uid();
  v_number   integer;
  v_next_id  text;
  v_pos      integer := greatest(0, coalesce(p_position_seconds, 0));
  v_dur      integer := greatest(0, coalesce(p_duration_seconds, 0));
  v_finished boolean;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  -- Integrity: the episode must exist AND belong to the given show. This both
  -- validates client input and gives us the episode number for advancement.
  select e.number into v_number
  from public.episodes e
  where e.id = p_episode_id and e.show_id = p_show_id;

  if v_number is null then
    raise exception 'unknown episode % for show %', p_episode_id, p_show_id;
  end if;

  -- Finished when we know the duration and the user is >=90% through it.
  v_finished := (v_dur > 0 and v_pos::numeric / v_dur >= 0.9);

  if v_finished then
    select e2.id into v_next_id
    from public.episodes e2
    where e2.show_id = p_show_id and e2.number > v_number
    order by e2.number asc
    limit 1;

    if v_next_id is null then
      -- Finished the last episode: the show leaves "Continue Watching".
      delete from public.watch_progress where user_id = uid and show_id = p_show_id;
      return;
    end if;

    -- Advance: surface the next episode at position 0 ("up next").
    insert into public.watch_progress
      (user_id, show_id, episode_id, position_seconds, duration_seconds, updated_at)
    values (uid, p_show_id, v_next_id, 0, 0, now())
    on conflict (user_id, show_id) do update
      set episode_id = excluded.episode_id,
          position_seconds = 0,
          duration_seconds = 0,
          updated_at = now();
    return;
  end if;

  -- In-progress: store/refresh the current resume point.
  insert into public.watch_progress
    (user_id, show_id, episode_id, position_seconds, duration_seconds, updated_at)
  values (uid, p_show_id, p_episode_id, v_pos, v_dur, now())
  on conflict (user_id, show_id) do update
    set episode_id = excluded.episode_id,
        position_seconds = excluded.position_seconds,
        duration_seconds = excluded.duration_seconds,
        updated_at = now();
end;
$$;

-- Row Level Security --------------------------------------------------------
alter table public.watch_progress enable row level security;

drop policy if exists "Users read own progress"   on public.watch_progress;
drop policy if exists "Users delete own progress"  on public.watch_progress;

-- SELECT only your own rows (private history; no anon, no cross-user reads).
create policy "Users read own progress"
  on public.watch_progress for select
  to authenticated
  using (auth.uid() = user_id);

-- DELETE only your own rows (dismiss a card from the rail).
create policy "Users delete own progress"
  on public.watch_progress for delete
  to authenticated
  using (auth.uid() = user_id);

-- No INSERT/UPDATE policies: clients cannot write the table directly; the
-- SECURITY DEFINER record_watch_progress() RPC is the only write path.

-- Table privileges (RLS governs rows; GRANT governs table access — need BOTH).
grant usage on schema public to authenticated;   -- already granted; harmless re-grant
grant select, delete on public.watch_progress to authenticated;
-- Note: deliberately NO grant to anon, and NO insert/update grant to anyone.

-- The write RPC is the only mutation surface exposed to clients.
grant execute on function public.record_watch_progress(text, text, integer, integer)
  to authenticated;

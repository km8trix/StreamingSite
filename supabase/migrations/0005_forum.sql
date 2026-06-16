-- 0005_forum.sql — Community forum (Milestone 3, Feature 3: FORUM).
--
-- Three tables:
--   - forum_categories: a fixed set of discussion areas (seeded only; never
--     client-writable). Public read.
--   - forum_threads:    a topic started by a user inside a category. Public read;
--     created by any signed-in user; the author may rename; MODERATORS may pin/lock.
--   - forum_posts:      a message in a thread (the thread's first post is created
--     together with the thread). Public read; created by any signed-in user when
--     the thread is not locked; authors may edit/soft-delete their own; MODERATORS
--     may soft-delete any post.
--
-- SECURITY MODEL — apply the hard-won auth+comments lessons, get it right FIRST:
--
--  (1) RLS is NOT enough. Every table ALSO needs GRANTs, and those grants are
--      COLUMN-RESTRICTED so a client cannot PATCH ownership/privilege/system
--      columns straight to PostgREST:
--        - threads: clients may insert (category_id,user_id,title,slug,show_id)
--          and update (title,is_pinned,is_locked). user_id / created_at /
--          last_activity_at are NEVER client-writable. (is_pinned/is_locked are
--          granted at the COLUMN level so the action can write them, but RLS only
--          lets a MODERATOR actually change them — see policies below.)
--        - posts: clients may insert (thread_id,user_id,body) and update
--          (body,is_edited,is_deleted). user_id / thread_id / created_at /
--          updated_at are NEVER client-writable, so a post can't be re-owned or
--          moved to another thread.
--  (2) INSERT WITH CHECK (user_id = auth.uid()) on threads & posts — you can
--      never post AS another user. The server actions also set user_id from
--      auth.uid(); RLS is the authoritative guard even against a raw REST insert.
--  (3) UPDATE/DELETE your OWN row only; MODERATOR actions (pin/lock a thread,
--      soft-delete any post) are gated by the is_moderator() SQL helper, which
--      reads the CALLER's profiles.role. role is NOT client-writable (enforced in
--      0003), so it cannot be self-escalated.
--  (4) forum_posts soft-delete is a ONE-WAY RATCHET enforced by a BEFORE UPDATE
--      trigger (a deleted post stays deleted + body stays '' — it can never be
--      un-deleted or repopulated, even via raw REST). is_edited is MONOTONIC
--      (once true, never reset). Same pattern as comments 0004.
--  (5) forum_threads.last_activity_at is bumped by an AFTER INSERT trigger on
--      forum_posts (SECURITY DEFINER) — it is NOT in any client grant, so clients
--      cannot forge thread bumping.

-- ===========================================================================
-- is_moderator() helper
-- ===========================================================================
-- SECURITY DEFINER + pinned empty search_path so it always resolves
-- public.profiles (never a caller-controlled path). Returns true when the
-- CALLER (auth.uid()) has role moderator or admin. role is set server-side only
-- (0003 column-restricted grant excludes it), so it can't be self-granted.
create or replace function public.is_moderator()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('moderator', 'admin')
  );
$$;

-- ===========================================================================
-- forum_categories
-- ===========================================================================
-- Fixed, seed-only discussion areas. Public read; NO write policies/grants for
-- anon/authenticated, so categories can only be changed by the service role
-- (seeding/admin out-of-band) — never from the app.
create table if not exists public.forum_categories (
  id          text primary key,
  name        text not null,
  slug        text not null,
  description text not null default '',
  sort_order  integer not null default 0
);

create unique index if not exists forum_categories_slug_key
  on public.forum_categories (slug);

-- ===========================================================================
-- forum_threads
-- ===========================================================================
create table if not exists public.forum_threads (
  id                uuid primary key default gen_random_uuid(),
  category_id       text not null references public.forum_categories (id) on delete cascade,
  user_id           uuid not null references public.profiles (id)         on delete cascade,
  title             text not null check (char_length(title) between 1 and 200),
  slug              text not null default '',
  is_pinned         boolean not null default false,
  is_locked         boolean not null default false,
  show_id           text references public.shows (id) on delete set null,
  created_at        timestamptz not null default now(),
  last_activity_at  timestamptz not null default now()
);

-- Indexes: list a category's threads (category_id), order by recent activity
-- (last_activity_at desc), and pinned-first (is_pinned desc).
create index if not exists forum_threads_category_idx
  on public.forum_threads (category_id);
create index if not exists forum_threads_activity_idx
  on public.forum_threads (last_activity_at desc);
create index if not exists forum_threads_pinned_idx
  on public.forum_threads (is_pinned desc, last_activity_at desc);

-- slug is the public, bookmarkable handle for a thread (/forum/thread/<slug>).
-- It MUST be unique so a slug-routed lookup resolves to exactly one row: two
-- threads with the same title would otherwise slugify to the same value and a
-- slug lookup (.maybeSingle) would error on the duplicate. createThread()
-- de-duplicates the slug before insert (mirrors handle_new_user's username
-- dedup); this UNIQUE index is the authoritative guard even against a raw REST
-- insert. (slug defaults to '' on the table; the data layer always sets a real
-- slug, and only one thread could ever hold '' before this index — historically
-- none do, so a plain UNIQUE is safe.)
create unique index if not exists forum_threads_slug_key
  on public.forum_threads (slug);

-- ===========================================================================
-- forum_posts
-- ===========================================================================
create table if not exists public.forum_posts (
  id          uuid primary key default gen_random_uuid(),
  thread_id   uuid not null references public.forum_threads (id) on delete cascade,
  user_id     uuid not null references public.profiles (id)      on delete cascade,
  -- Body is 1..10000 chars for a LIVE post; a soft-deleted post carries a blank
  -- body ('') because its text is erased on delete (and the integrity trigger
  -- forces it back to '' on any further update). The CHECK allows empty ONLY
  -- when is_deleted is true.
  body        text not null check (
                char_length(body) <= 10000
                and (is_deleted or char_length(body) >= 1)
              ),
  is_edited   boolean not null default false,
  is_deleted  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Index: list a thread's posts oldest-first (thread_id, created_at).
create index if not exists forum_posts_thread_idx
  on public.forum_posts (thread_id, created_at);

-- ===========================================================================
-- Triggers
-- ===========================================================================

-- updated_at on forum_posts (reuse the shared helper from 0001).
drop trigger if exists forum_posts_set_updated_at on public.forum_posts;
create trigger forum_posts_set_updated_at
  before update on public.forum_posts
  for each row execute function public.set_updated_at();

-- Content-integrity trigger on forum_posts (same approach as comments 0004).
-- The column-restricted UPDATE grant must include is_deleted/is_edited so the
-- server actions can soft-delete / mark-edited. Column grants cannot express
-- STATE-TRANSITION invariants, so without this a user could raw-PATCH their OWN
-- post to un-delete + repopulate it, or erase the "(edited)" marker. This
-- BEFORE UPDATE trigger COERCES the NEW values rather than raising — the legit
-- actions only ever set these flags TRUE, so coercion never breaks them; it only
-- blocks the illegitimate reversals.
--
--   - is_deleted is a ONE-WAY RATCHET: once deleted, the row stays deleted and
--     its body stays '' — it can never be revived or repopulated.
--   - is_edited is MONOTONIC: once true it can never be reset to false.
--
-- SECURITY: schema-qualified; search_path pinned to '' so it never resolves
-- objects through a caller-controlled path.
create or replace function public.enforce_forum_post_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- One-way delete ratchet.
  if old.is_deleted then
    new.is_deleted := true;
    new.body := '';
  end if;

  -- Monotonic edit marker.
  if old.is_edited then
    new.is_edited := true;
  end if;

  return new;
end;
$$;

drop trigger if exists forum_posts_enforce_integrity on public.forum_posts;
create trigger forum_posts_enforce_integrity
  before update on public.forum_posts
  for each row execute function public.enforce_forum_post_integrity();

-- Bump the parent thread's last_activity_at when a post is inserted. SECURITY
-- DEFINER so it can update forum_threads regardless of the caller's row-level
-- privileges; last_activity_at is NOT in any client grant, so this trigger is
-- the only way it changes — clients cannot forge thread bumping.
create or replace function public.bump_thread_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.forum_threads
     set last_activity_at = now()
   where id = new.thread_id;
  return new;
end;
$$;

drop trigger if exists forum_posts_bump_thread on public.forum_posts;
create trigger forum_posts_bump_thread
  after insert on public.forum_posts
  for each row execute function public.bump_thread_activity();

-- ===========================================================================
-- Row Level Security
-- ===========================================================================
alter table public.forum_categories enable row level security;
alter table public.forum_threads    enable row level security;
alter table public.forum_posts      enable row level security;

-- --- forum_categories: public read only ------------------------------------
drop policy if exists "Public read forum_categories" on public.forum_categories;

create policy "Public read forum_categories"
  on public.forum_categories for select
  to anon, authenticated
  using (true);
-- No insert/update/delete policies => only the service role can change
-- categories (seeded out-of-band).

-- --- forum_threads ---------------------------------------------------------
drop policy if exists "Public read forum_threads"        on public.forum_threads;
drop policy if exists "Users insert own thread"          on public.forum_threads;
drop policy if exists "Author or mod update thread"      on public.forum_threads;
drop policy if exists "Author or mod delete thread"      on public.forum_threads;

-- Public SELECT: anyone (anon + signed-in) can read threads.
create policy "Public read forum_threads"
  on public.forum_threads for select
  to anon, authenticated
  using (true);

-- INSERT only as yourself. WITH CHECK pins the new row's user_id to the caller,
-- so a user CANNOT start a thread attributed to someone else.
create policy "Users insert own thread"
  on public.forum_threads for insert
  to authenticated
  with check (auth.uid() = user_id);

-- UPDATE: the thread's author (rename only) OR a moderator (pin/lock too).
--   - USING gates WHICH rows you may touch: your own thread, or any thread if
--     you're a moderator.
--   - WITH CHECK keeps user_id pinned (no re-owning) AND — for a NON-moderator —
--     pins is_pinned / is_locked to their CURRENT stored values, so an author can
--     only ever change `title`. A moderator (is_moderator()) is exempt from that
--     pin/lock constraint and may flip the moderation flags on ANY thread.
-- This is the contract's "own row (title) OR is_moderator() (is_pinned/is_locked)":
-- the column-restricted grant lets the action WRITE these columns, but RLS makes
-- pin/lock a no-op-or-reject for non-mods even via a raw REST PATCH.
create policy "Author or mod update thread"
  on public.forum_threads for update
  to authenticated
  using (auth.uid() = user_id or public.is_moderator())
  with check (
    (auth.uid() = user_id or public.is_moderator())
    and (
      public.is_moderator()
      or (
        is_pinned = (select t.is_pinned from public.forum_threads t where t.id = forum_threads.id)
        and is_locked = (select t.is_locked from public.forum_threads t where t.id = forum_threads.id)
      )
    )
  );

-- DELETE: the author OR a moderator.
create policy "Author or mod delete thread"
  on public.forum_threads for delete
  to authenticated
  using (auth.uid() = user_id or public.is_moderator());

-- --- forum_posts -----------------------------------------------------------
drop policy if exists "Public read forum_posts"      on public.forum_posts;
drop policy if exists "Users insert own post"        on public.forum_posts;
drop policy if exists "Author or mod update post"    on public.forum_posts;
drop policy if exists "Author or mod delete post"    on public.forum_posts;

-- Public SELECT.
create policy "Public read forum_posts"
  on public.forum_posts for select
  to anon, authenticated
  using (true);

-- INSERT only as yourself AND only into an UNLOCKED thread — UNLESS you are a
-- moderator (mods can post in locked threads, e.g. to add a closing note). The
-- subquery reads the parent thread's is_locked. WITH CHECK pins user_id to the
-- caller so you cannot post AS someone else.
create policy "Users insert own post"
  on public.forum_posts for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and (
      public.is_moderator()
      or not exists (
        select 1 from public.forum_threads t
        where t.id = forum_posts.thread_id and t.is_locked
      )
    )
  );

-- UPDATE: the post's author (edit / soft-delete own) OR a moderator (soft-delete
-- any post). WITH CHECK keeps user_id pinned so the row can't be re-owned. The
-- column-restricted grant limits writable columns to body / is_edited /
-- is_deleted; the integrity trigger enforces the one-way ratchet.
create policy "Author or mod update post"
  on public.forum_posts for update
  to authenticated
  using (auth.uid() = user_id or public.is_moderator())
  with check (auth.uid() = user_id or public.is_moderator());

-- DELETE (hard): the author OR a moderator. Soft-delete (UPDATE is_deleted=true)
-- is the preferred path; a hard delete is also allowed for owners/mods.
create policy "Author or mod delete post"
  on public.forum_posts for delete
  to authenticated
  using (auth.uid() = user_id or public.is_moderator());

-- ===========================================================================
-- Table privileges (RLS governs ROWS; GRANT governs column/table access — BOTH)
-- ===========================================================================
grant usage on schema public to anon, authenticated;  -- already granted; harmless re-grant

-- Public read on all three.
grant select on public.forum_categories to anon, authenticated;
grant select on public.forum_threads    to anon, authenticated;
grant select on public.forum_posts      to anon, authenticated;

-- forum_categories: NO insert/update/delete grant for anon/authenticated
-- (seed-only; service role bypasses grants/RLS).

-- forum_threads ------------------------------------------------------------
-- COLUMN-RESTRICTED insert: a client may only supply these. id, is_pinned,
-- is_locked, created_at, last_activity_at keep their server-side defaults and
-- cannot be forged at insert time (a new thread is never born pinned/locked).
-- (user_id is listed because RLS WITH CHECK requires it = auth.uid(); the action
-- always sets it from auth.uid(), never from client input.)
grant insert (category_id, user_id, title, slug, show_id)
  on public.forum_threads to authenticated;

-- COLUMN-RESTRICTED update: a client may only write title (author rename) and
-- the moderation flags. RLS limits pin/lock on OTHERS' threads to moderators.
-- user_id / category_id / show_id / created_at / last_activity_at are NOT
-- writable, so a thread can never be re-owned, re-categorized, or have its
-- activity timestamp forged.
grant update (title, is_pinned, is_locked)
  on public.forum_threads to authenticated;

-- DELETE is a row-level privilege; grant it so the own/mod DELETE policy is
-- reachable.
grant delete on public.forum_threads to authenticated;

-- forum_posts --------------------------------------------------------------
-- COLUMN-RESTRICTED insert: only thread_id / user_id / body. is_edited,
-- is_deleted, created_at, updated_at default server-side. (user_id listed for
-- the RLS WITH CHECK; set from auth.uid() server-side.)
grant insert (thread_id, user_id, body) on public.forum_posts to authenticated;

-- COLUMN-RESTRICTED update: only body + the two flags. user_id / thread_id /
-- created_at / updated_at are NOT writable, so a post can never be re-owned or
-- moved to another thread.
grant update (body, is_edited, is_deleted) on public.forum_posts to authenticated;

grant delete on public.forum_posts to authenticated;

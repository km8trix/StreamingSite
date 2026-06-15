-- 0003_auth_profiles.sql — Accounts / public profiles (Milestone 3, Feature 1: AUTH).
--
-- A `profiles` row is the PUBLIC face of an authenticated account (username,
-- display name, avatar, role). Each profile is 1:1 with an `auth.users` row and
-- is created automatically by a SECURITY DEFINER trigger when a user signs up —
-- clients never INSERT/DELETE profiles directly.
--
-- RLS: profiles are PUBLIC SELECT (display names/avatars are public); a user may
-- UPDATE only their own row (auth.uid() = id). No client INSERT/DELETE.
--
-- LESSON from M1/M2: RLS policies are not enough — PostgREST roles also need
-- GRANTs, or reads/writes fail with "permission denied for table profiles".

-- profiles -----------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  username      text unique,
  display_name  text,
  avatar_url    text,
  role          text not null default 'user'
                  check (role in ('user', 'moderator', 'admin')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Case-insensitive uniqueness on username (the column `unique` above is
-- case-sensitive; this enforces that 'Alice' and 'alice' can't co-exist, which
-- is also what handle_new_user()'s dedup loop assumes). Distinct index name so
-- it doesn't collide with the auto-generated `profiles_username_key` constraint.
create unique index if not exists profiles_username_lower_key
  on public.profiles (lower(username));

-- updated_at trigger (reuse the shared helper from 0001) --------------------
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- New-user -> profile trigger ----------------------------------------------
-- Runs as the table owner (SECURITY DEFINER) so it can INSERT into public.profiles
-- even though the inserting context (the auth service) is not the profiles owner
-- and RLS would otherwise block a client-side insert.
--
-- username derivation: prefer raw_user_meta_data->>'username' (passed via
-- supabase.auth.signUp options.data), else the email local-part. The candidate
-- is sanitized to [a-z0-9_], lower-cased, and de-duplicated with a numeric suffix
-- if already taken (case-insensitively). display_name prefers the metadata
-- display_name, then the metadata username, then the raw email local-part.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta_username     text := nullif(trim(new.raw_user_meta_data ->> 'username'), '');
  meta_display_name text := nullif(trim(new.raw_user_meta_data ->> 'display_name'), '');
  email_local       text := split_part(coalesce(new.email, ''), '@', 1);
  raw_candidate     text;
  base_username     text;
  final_username    text;
  display           text;
  suffix            integer := 0;
begin
  -- Pick the source for the username, then sanitize to a safe handle.
  -- Cap the base at 30 chars so the generated handle satisfies the same
  -- 3–30 limit the updateProfile server action enforces — otherwise a long
  -- email local-part yields a >30-char username the owner can never re-save.
  raw_candidate := coalesce(meta_username, nullif(email_local, ''), 'user');
  base_username := left(lower(regexp_replace(raw_candidate, '[^a-zA-Z0-9_]', '', 'g')), 30);
  if base_username is null or base_username = '' then
    base_username := 'user';
  end if;

  -- De-duplicate (case-insensitive) with a numeric suffix. Keep the final
  -- handle <=30 by trimming the base so base + suffix never exceeds 30.
  final_username := base_username;
  while exists (
    select 1 from public.profiles p where lower(p.username) = lower(final_username)
  ) loop
    suffix := suffix + 1;
    final_username := left(base_username, 30 - length(suffix::text)) || suffix::text;
  end loop;

  -- display_name: metadata display_name > metadata username > email local-part > username.
  display := coalesce(meta_display_name, meta_username, nullif(email_local, ''), final_username);

  insert into public.profiles (id, username, display_name)
  values (new.id, final_username, display);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Row Level Security --------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists "Public read profiles"      on public.profiles;
drop policy if exists "Users update own profile"  on public.profiles;

-- Public SELECT: profiles (username / display name / avatar / role) are public.
create policy "Public read profiles"
  on public.profiles for select
  to anon, authenticated
  using (true);

-- UPDATE only your own row. WITH CHECK keeps the id pinned to the caller so a
-- user can't re-key their profile onto someone else's auth.users id, and pins
-- role unchanged as defense-in-depth (the column-restricted GRANT below is the
-- primary control — it removes `role` from the set of columns clients can write
-- at all).
create policy "Users update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role = (select p.role from public.profiles p where p.id = profiles.id)
  );

-- No INSERT / DELETE policies exist => clients cannot insert or delete. The
-- SECURITY DEFINER trigger above is the only insert path; account deletion
-- cascades from auth.users.

-- Table privileges (RLS governs rows; GRANT governs table access — need BOTH).
grant usage on schema public to anon, authenticated;       -- already granted in 0001; harmless re-grant
grant select on public.profiles to anon, authenticated;
-- COLUMN-RESTRICTED update grant: clients may write ONLY these display fields.
-- A table-level `grant update on public.profiles` would let an authenticated
-- user PATCH any column — including `role` — straight to PostgREST and
-- self-promote to admin (RLS's auth.uid()=id passes for their own row). By
-- granting update on the specific columns only, `role`, `id`, and the
-- timestamps are not writable by anon/authenticated at all (PostgREST returns
-- "permission denied for column"/0 rows). The updateProfile server action only
-- writes username/display_name/avatar_url, so it keeps working.
grant update (username, display_name, avatar_url) on public.profiles to authenticated;

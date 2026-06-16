-- 0008_oauth_profile_metadata.sql — capture OAuth identity metadata on signup.
--
-- WHY: with Google "Sign in with Google" (OAuth), a new auth.users row carries
-- the provider's profile in raw_user_meta_data — typically `full_name`/`name`
-- and `avatar_url`/`picture` (NOT our custom `username`/`display_name` keys used
-- by email/password signup). The original handle_new_user() (0003) only looked
-- at those custom keys + the email local-part, so Google users landed with a
-- bare email-derived display name and no avatar.
--
-- This migration REPLACES handle_new_user() so it ALSO falls back to the OAuth
-- full_name (for display_name) and avatar_url/picture (for avatar_url). Behavior
-- for email/password signups is unchanged — those still prefer the explicit
-- `username`/`display_name` metadata. Idempotent: create-or-replace + the same
-- trigger wiring as 0003.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta_username     text := nullif(trim(new.raw_user_meta_data ->> 'username'), '');
  meta_display_name text := nullif(trim(new.raw_user_meta_data ->> 'display_name'), '');
  -- OAuth providers (Google) supply the human name + avatar under these keys.
  meta_full_name    text := nullif(trim(coalesce(
                              new.raw_user_meta_data ->> 'full_name',
                              new.raw_user_meta_data ->> 'name')), '');
  meta_avatar       text := nullif(trim(coalesce(
                              new.raw_user_meta_data ->> 'avatar_url',
                              new.raw_user_meta_data ->> 'picture')), '');
  email_local       text := split_part(coalesce(new.email, ''), '@', 1);
  raw_candidate     text;
  base_username     text;
  final_username    text;
  display           text;
  suffix            integer := 0;
begin
  -- avatar_url is rendered as a plain <img src> to OTHER users (comments/forum),
  -- so only accept an http(s) URL (reject data:/javascript:/relative tracking
  -- vectors) and bound its length. NULL passes through left() unchanged.
  if meta_avatar is not null and meta_avatar !~* '^https?://' then
    meta_avatar := null;
  end if;
  meta_avatar := left(meta_avatar, 2048);

  -- Pick the source for the username, then sanitize to a safe handle.
  -- Cap the base at 30 chars AND pad up to the 3-char floor so the generated
  -- handle satisfies the SAME 3–30 limit the updateProfile server action
  -- enforces (a 1–2 char email local-part would otherwise mint a username the
  -- owner can never re-submit).
  raw_candidate := coalesce(meta_username, nullif(email_local, ''), 'user');
  base_username := left(lower(regexp_replace(raw_candidate, '[^a-zA-Z0-9_]', '', 'g')), 30);
  if base_username is null or base_username = '' then
    base_username := 'user';
  end if;
  if length(base_username) < 3 then
    base_username := rpad(base_username, 3, '0');
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

  -- display_name preference: explicit display_name > explicit username >
  -- OAuth full name > email local-part > generated username.
  display := coalesce(
    meta_display_name, meta_username, meta_full_name,
    nullif(email_local, ''), final_username);

  insert into public.profiles (id, username, display_name, avatar_url)
  values (new.id, final_username, left(display, 80), meta_avatar);

  return new;
end;
$$;

-- Re-assert the trigger (no-op if already present from 0003).
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

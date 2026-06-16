-- 0004_comments.sql — Per-show comments (Milestone 3, Feature 2: COMMENTS).
--
-- A `comments` row is a public message a signed-in user posts on a show's detail
-- page. One level of threading: a comment is either top-level (`parent_id` null)
-- or a reply to a top-level comment (`parent_id` set). Comments are SOFT-deleted
-- (`is_deleted` = true) so reply threads stay intact; the UI renders deleted rows
-- as "[deleted]" with the body blanked by the data layer.
--
-- RLS: comments are PUBLIC SELECT (anyone can read a show's discussion). Writes
-- are auth-gated:
--   - INSERT only when the new row's user_id = auth.uid() (you cannot post AS
--     someone else);
--   - UPDATE / DELETE only your own row (auth.uid() = user_id).
--
-- LESSON from M1/M2/auth (privilege escalation): RLS policies are NOT enough.
-- PostgREST roles also need GRANTs, AND those grants must be COLUMN-RESTRICTED so
-- a client cannot PATCH ownership/structural columns straight to the REST API:
--   - INSERT grant lists (show_id, user_id, parent_id, body) — created_at/updated_at
--     and the is_edited/is_deleted flags default server-side; a client cannot set
--     them on insert, and CANNOT set them to anything either way (not granted).
--   - UPDATE grant lists ONLY (body, is_edited, is_deleted) — user_id, show_id,
--     parent_id and the timestamps are NOT writable by anon/authenticated at all,
--     so a comment can never be re-parented, re-keyed onto another user, or moved
--     to another show after creation. Editing sets is_edited; soft-delete sets
--     is_deleted.

-- comments -----------------------------------------------------------------
create table if not exists public.comments (
  id          uuid primary key default gen_random_uuid(),
  show_id     text not null references public.shows (id)    on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  parent_id   uuid references public.comments (id)          on delete cascade,
  -- Body is 1..4000 chars for a LIVE comment; a soft-deleted comment carries a
  -- blank body ('') because its text is erased on delete (and the content-integrity
  -- trigger below forces it back to '' on any further update). The CHECK therefore
  -- allows empty ONLY when is_deleted is true.
  body        text not null check (
                char_length(body) <= 4000
                and (is_deleted or char_length(body) >= 1)
              ),
  is_edited   boolean not null default false,
  is_deleted  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Indexes: list a show's comments (show_id), gather a thread's replies
-- (parent_id), and order chronologically (created_at).
create index if not exists comments_show_idx       on public.comments (show_id);
create index if not exists comments_parent_idx      on public.comments (parent_id);
create index if not exists comments_created_at_idx  on public.comments (created_at desc);

-- updated_at trigger (reuse the shared helper from 0001) --------------------
drop trigger if exists comments_set_updated_at on public.comments;
create trigger comments_set_updated_at
  before update on public.comments
  for each row execute function public.set_updated_at();

-- Content-integrity trigger (M3 COMMENTS hardening) -------------------------
-- The column-restricted UPDATE grant has to include is_deleted and is_edited so
-- the server actions can soft-delete / mark-edited as the authenticated user.
-- But column grants cannot express STATE-TRANSITION invariants, so a user could
-- raw-PATCH their OWN row to abuse content integrity:
--   - un-delete + repopulate: PATCH {is_deleted:false} then {body:..,is_edited:true}
--     turns a "[deleted]" comment live again with arbitrary text;
--   - erase the edit marker: PATCH {is_edited:false} hides that an edit happened.
--
-- A BEFORE UPDATE trigger enforces these invariants regardless of HOW the UPDATE
-- arrives (PostgREST raw PATCH or the server action), by COERCING the NEW values
-- rather than raising — the legit actions only ever set these flags TRUE, so
-- coercion never breaks them; it only blocks the illegitimate reversals.
--
--   - is_deleted is a ONE-WAY RATCHET: once a row is deleted it stays deleted and
--     its body stays blank ('') — you cannot un-delete or repopulate it.
--   - is_edited is MONOTONIC: once true it can never be reset to false.
--
-- SECURITY: schema-qualified table/trigger; the function pins search_path = '' so
-- it never resolves objects through a caller-controlled path.
create or replace function public.enforce_comment_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- One-way delete ratchet: an already-deleted comment can never be revived or
  -- repopulated. (The legit soft-delete is the OLD.is_deleted = false -> true
  -- transition, which this leaves untouched, so the action's body still lands.)
  if old.is_deleted then
    new.is_deleted := true;
    new.body := '';
  end if;

  -- Monotonic edit marker: once edited, the "(edited)" indicator can't be erased.
  if old.is_edited then
    new.is_edited := true;
  end if;

  return new;
end;
$$;

drop trigger if exists comments_enforce_integrity on public.comments;
create trigger comments_enforce_integrity
  before update on public.comments
  for each row execute function public.enforce_comment_integrity();

-- Row Level Security --------------------------------------------------------
alter table public.comments enable row level security;

drop policy if exists "Public read comments"     on public.comments;
drop policy if exists "Users insert own comment" on public.comments;
drop policy if exists "Users update own comment" on public.comments;
drop policy if exists "Users delete own comment" on public.comments;

-- Public SELECT: a show's discussion is readable by anyone (anon + signed-in).
-- Soft-deleted rows are still returned (the data layer blanks the body); reply
-- threads stay coherent.
create policy "Public read comments"
  on public.comments for select
  to anon, authenticated
  using (true);

-- INSERT only as yourself. WITH CHECK pins the new row's user_id to the caller,
-- so a user CANNOT post a comment attributed to someone else (the spoofing case
-- the contract calls out). The server action also sets user_id from auth.uid(),
-- but this is the authoritative control even against a raw PostgREST INSERT.
create policy "Users insert own comment"
  on public.comments for insert
  to authenticated
  with check (auth.uid() = user_id);

-- UPDATE only your own row (used for edits AND the soft-delete path, which is an
-- UPDATE that sets is_deleted = true). USING gates the rows you may touch;
-- WITH CHECK keeps user_id pinned to you so an UPDATE can't re-assign ownership.
create policy "Users update own comment"
  on public.comments for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- DELETE only your own row. Soft-delete (UPDATE is_deleted=true) is the preferred
-- path so threads survive, but a hard delete of your own comment is permitted.
create policy "Users delete own comment"
  on public.comments for delete
  to authenticated
  using (auth.uid() = user_id);

-- Table privileges (RLS governs rows; GRANT governs column/table access — BOTH).
grant usage on schema public to anon, authenticated;   -- already granted; harmless re-grant

-- Public read.
grant select on public.comments to anon, authenticated;

-- COLUMN-RESTRICTED insert: a client may only supply these four columns. id,
-- is_edited, is_deleted, created_at and updated_at are NOT granted, so they keep
-- their server-side defaults and cannot be forged at insert time. (user_id is
-- listed because RLS WITH CHECK requires it to equal auth.uid(); the server
-- action always sets it from auth.uid(), never from client input.)
grant insert (show_id, user_id, parent_id, body) on public.comments to authenticated;

-- COLUMN-RESTRICTED update: a client may only write the body and the two flags.
-- user_id / show_id / parent_id / created_at are NOT writable by anon or
-- authenticated, so a comment can never be re-owned, re-parented, or moved to
-- another show after creation (PostgREST returns "permission denied for column").
grant update (body, is_edited, is_deleted) on public.comments to authenticated;

-- DELETE is a row-level privilege (no columns); grant it so the own-row DELETE
-- policy above is reachable.
grant delete on public.comments to authenticated;

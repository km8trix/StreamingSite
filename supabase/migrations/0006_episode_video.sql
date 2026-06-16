-- 0006_episode_video.sql — Real video playback (HLS) for episodes.
--
-- Adds a nullable `video_url` to public.episodes holding the URL of an HLS
-- (.m3u8) manifest for that episode. Nullable: episodes without a source yet
-- render the UI's "coming soon" path. No new grants/policies are needed —
-- episodes already has public SELECT (0001) and the catalog stays read-only
-- from the app (seeding/admin happens out-of-band via the service role).
--
-- Additive + idempotent: safe to re-run; `npx supabase db reset` re-applies it.

alter table public.episodes
  add column if not exists video_url text;

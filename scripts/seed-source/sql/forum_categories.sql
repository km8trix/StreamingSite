-- forum_categories --------------------------------------------------------
-- Milestone 3, Feature 3 (FORUM): a fixed set of public discussion areas.
-- Seed-only (no client write path); stable text ids. Idempotent upsert so
-- `npx supabase db reset` re-seeds cleanly without a truncate (forum_threads /
-- forum_posts cascade off auth.users, which db reset wipes separately).
insert into public.forum_categories (id, name, slug, description, sort_order) values
  ('cat-general',         'General Discussion', 'general-discussion', 'Talk about anything anime — news, hot takes, and everything in between.', 1),
  ('cat-seasonal',        'Seasonal Anime',     'seasonal-anime',     'Discuss the currently-airing season: episode reactions, weekly threads, and standouts.', 2),
  ('cat-recommendations', 'Recommendations',    'recommendations',    'Ask for and share recommendations — find your next watch.', 3),
  ('cat-feedback',        'Site Feedback',      'site-feedback',      'Bugs, feature requests, and feedback about the site itself.', 4)
on conflict (id) do update set
  name        = excluded.name,
  slug        = excluded.slug,
  description = excluded.description,
  sort_order  = excluded.sort_order;

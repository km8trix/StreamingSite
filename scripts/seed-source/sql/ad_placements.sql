-- ad_placements -----------------------------------------------------------
-- Roadmap: non-invasive advertising. HOUSE ads (first-party promos) so the ad
-- slots have content without a real ad network. Each row binds a creative to a
-- named slot (placement_key). Images use placehold.co (already allowlisted in
-- next.config.ts). Idempotent: `on conflict (id) do nothing` so a re-seed never
-- duplicates and never clobbers any out-of-band edits to an existing ad.
--   home-banner  -> promote the Forum         (970x90 leaderboard)
--   grid-native  -> promote the Randomizer    (300x250 native card)
--   sidebar      -> promote sign-up + Schedule (300x250 each)
-- ad-005 is is_active=false to prove RLS hides inactive/unsold creatives.
insert into public.ad_placements
  (id, placement_key, name, image_url, target_url, alt_text, weight, is_active)
values
  ('ad-001', 'home-banner', 'House — Join the Forum',
   'https://placehold.co/970x90/1a1a2e/8b5cf6?text=Join+the+Discussion',
   '/forum', 'Join the discussion on the Senpai forum', 1, true),
  ('ad-002', 'grid-native', 'House — Surprise Me (Randomizer)',
   'https://placehold.co/300x250/1a1a2e/8b5cf6?text=Surprise+Me',
   '/random', 'Feeling lucky? Jump to a random anime', 1, true),
  ('ad-003', 'sidebar', 'House — Create an Account',
   'https://placehold.co/300x250/1a1a2e/8b5cf6?text=Create+an+Account',
   '/signup', 'Create a free account to comment and post', 2, true),
  ('ad-004', 'sidebar', 'House — Weekly Release Schedule',
   'https://placehold.co/300x250/1a1a2e/8b5cf6?text=Weekly+Schedule',
   '/schedule', 'See this week''s anime release schedule', 1, true),
  ('ad-005', 'home-banner', 'House — INACTIVE promo (RLS hidden)',
   'https://placehold.co/970x90/1a1a2e/8b5cf6?text=Hidden+Promo',
   '/signup', 'This inactive ad must never reach a client', 1, false)
on conflict (id) do nothing;

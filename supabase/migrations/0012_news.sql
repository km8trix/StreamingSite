-- 0012_news.sql — Anime news & headlines table.
-- Curated headlines that link OUT to their original source.
-- RLS: public (anon + authenticated) SELECT only — no write policies (matches
-- 0001/0002 style). source_url / image_url are constrained to https so the UI
-- never renders a non-secure outbound link or image (mirrors 0010 for ads).

-- news ----------------------------------------------------------------------
create table if not exists public.news (
  id           text primary key,
  slug         text not null unique,
  title        text not null,
  summary      text not null default '',
  source       text not null default '',
  source_url   text not null check (source_url ~ '^https://'),
  category     text not null default '',
  image_url    text check (image_url is null or image_url ~ '^https://'),
  published_at timestamptz not null default now()
);

-- Index: the page lists newest-first.
create index if not exists news_published_idx on public.news (published_at desc);

-- Row Level Security --------------------------------------------------------
alter table public.news enable row level security;

drop policy if exists "Public read news" on public.news;

create policy "Public read news"
  on public.news for select
  to anon, authenticated
  using (true);

-- Table privileges (RLS governs rows; GRANT governs table access — need both).
grant select on public.news to anon, authenticated;

-- Seed -----------------------------------------------------------------------
-- Curated demo headlines. Kept in sync with SEED_NEWS in src/lib/data/news.ts.
-- News is NOT part of the generated seed.sql (that file is overwritten by
-- scripts/build_seed.mjs), so we seed it here. Idempotent via ON CONFLICT.
insert into public.news
  (id, slug, title, summary, source, source_url, category, image_url, published_at)
values
  ('news-001', 'summer-2026-season-preview',
   'Summer 2026 Anime Season Preview: The Premieres to Watch',
   'A rundown of the new series and returning favorites headlining the upcoming season, from blockbuster sequels to original debuts.',
   'Anime News Network', 'https://www.animenewsnetwork.com', 'New Anime', NULL,
   '2026-06-15T09:00:00.000Z'),
  ('news-002', 'studio-spotlight-reinvention',
   'Studio Spotlight: How a Veteran Animation House Is Reinventing Itself',
   'Inside a long-running studio''s push into new production pipelines and the staff betting on a bold next chapter.',
   'Crunchyroll News', 'https://www.crunchyroll.com/news', 'Industry', NULL,
   '2026-06-14T15:30:00.000Z'),
  ('news-003', 'shonen-manga-final-arc',
   'Long-Running Shonen Manga Enters Its Final Arc',
   'After more than a decade in serialization, the beloved series begins the storyline its author calls the true ending.',
   'Anime News Network', 'https://www.animenewsnetwork.com', 'Manga', NULL,
   '2026-06-13T12:00:00.000Z'),
  ('news-004', 'theatrical-anime-box-office-milestone',
   'Theatrical Anime Crosses a Major Global Box-Office Milestone',
   'Strong overseas demand pushes the latest theatrical release past a benchmark few anime films reach.',
   'Crunchyroll News', 'https://www.crunchyroll.com/news', 'Box Office', NULL,
   '2026-06-12T18:45:00.000Z'),
  ('news-005', 'fantasy-series-second-season-confirmed',
   'Beloved Fantasy Series Confirmed for a Second Season',
   'The announcement caps months of fan speculation, with the staff teasing an expanded world and new arcs.',
   'Anime News Network', 'https://www.animenewsnetwork.com', 'New Anime', NULL,
   '2026-06-11T10:15:00.000Z'),
  ('news-006', 'voice-cast-revealed-adaptation',
   'Voice Cast Revealed for Upcoming Adaptation',
   'The production unveils its principal cast alongside a first teaser visual ahead of the premiere window.',
   'MyAnimeList News', 'https://myanimelist.net/news', 'Industry', NULL,
   '2026-06-10T08:00:00.000Z'),
  ('news-007', 'streaming-simulcast-lineups-expand',
   'Streaming Platforms Expand Simulcast Lineups for the New Season',
   'More same-day releases mean international viewers can keep pace with Japan across a wider slate of titles.',
   'Crunchyroll News', 'https://www.crunchyroll.com/news', 'Industry', NULL,
   '2026-06-09T14:20:00.000Z'),
  ('news-008', 'award-season-standouts',
   'Award Season: This Year''s Standout Series and Films',
   'Critics and fans weigh in on the titles dominating this year''s nominations across categories.',
   'Anime News Network', 'https://www.animenewsnetwork.com', 'Events', NULL,
   '2026-06-07T11:00:00.000Z')
on conflict (id) do nothing;

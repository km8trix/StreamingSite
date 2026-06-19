// Build the streaming catalog seed: src/lib/data/seed.json AND
// supabase/seed/seed.sql, from the vendored source under scripts/seed-source/.
//
// History: the catalog originally came from the Jikan API (MyAnimeList top
// anime) transformed by this script — slugs, synthesized dub counts, and
// weekly episode lists. Since then the seed has been hand-curated: the
// currently-airing shows carry hand-set air dates / dub counts for the release
// schedule, one slug was hand-fixed, and later milestones appended airing
// slots, forum categories, and house ad placements. That curated data can no
// longer be reproduced from a live Jikan fetch, so the resolved snapshot is
// vendored under scripts/seed-source/ and this script formats it into the two
// committed artifacts. Re-running it is a no-op against the committed seed.
//
//   scripts/seed-source/catalog.json        — metadata + genres + shows
//                                              (episodes carry no video_url;
//                                              this script owns that column)
//   scripts/seed-source/airing-slots.json   — weekly air slots (SQL + JSON)
//   scripts/seed-source/ad-placements.json  — house ads (seed.json only)
//   scripts/seed-source/sql/forum_categories.sql — verbatim SQL block
//   scripts/seed-source/sql/ad_placements.sql    — verbatim SQL block
//
// Run: `node scripts/build_seed.mjs`

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'scripts', 'seed-source');

const read = (p) => readFileSync(p, 'utf8');
const readJson = (p) => JSON.parse(read(p));

const catalog = readJson(join(SRC, 'catalog.json'));
const airingSlots = readJson(join(SRC, 'airing-slots.json'));
const adPlacements = readJson(join(SRC, 'ad-placements.json'));
const forumSql = read(join(SRC, 'sql', 'forum_categories.sql'));
const adSql = read(join(SRC, 'sql', 'ad_placements.sql'));

const { genres, shows } = catalog;

// ---- seed.json (full ShowDetail records; data layer derives summaries) ----
// Episodes get an explicit video_url, defaulting to null — Senpai no longer
// hosts owned streams, so every episode renders the "official embeds" path.

const seedJson = {
  generatedAt: catalog.generatedAt,
  source: catalog.source,
  note: catalog.note,
  genres,
  shows: shows.map((s) => ({
    ...s,
    episodes: s.episodes.map((e) => ({ ...e, videoUrl: e.videoUrl ?? null })),
  })),
  airingSlots,
  adPlacements,
};

writeFileSync(join(ROOT, 'src/lib/data/seed.json'), JSON.stringify(seedJson, null, 2) + '\n');

// ---- seed.sql ------------------------------------------------------------

function q(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  return `'${String(v).replace(/'/g, "''")}'`;
}

// derived join + flat episode lists, in show order (matches committed order)
const showGenres = []; // {showId, genreId}
const allEpisodes = []; // flat for sql
for (const s of shows) {
  for (const g of s.genres) showGenres.push({ showId: s.id, genreId: g.id });
  for (const e of s.episodes) allEpisodes.push({ ...e, videoUrl: e.videoUrl ?? null, showId: s.id });
}

let sql = `-- Seed data for the anime streaming catalog.
-- Generated from the Jikan API (MyAnimeList) by scripts/build_seed.mjs.
-- Idempotent: truncates then inserts. Safe to re-run against a live DB.
-- dubEpisodes are synthesized; episode lists are synthesized; everything
-- else (titles, synopses, cover URLs, genres, sub counts) is real Jikan data.

begin;

truncate table public.ad_placements, public.airing_slots, public.episodes, public.show_genres, public.shows, public.genres restart identity cascade;

-- genres -------------------------------------------------------------------
insert into public.genres (id, name, slug) values
`;
sql += genres
  .map((g) => `  (${q(g.id)}, ${q(g.name)}, ${q(g.slug)})`)
  .join(',\n') + ';\n\n';

sql += `-- shows --------------------------------------------------------------------
insert into public.shows
  (id, slug, title, cover_image, banner_image, synopsis, sub_episodes, dub_episodes, status, year, popularity_score, updated_at)
values
`;
sql += shows
  .map(
    (s) =>
      `  (${q(s.id)}, ${q(s.slug)}, ${q(s.title)}, ${q(s.coverImage)}, ${q(s.bannerImage)}, ${q(s.synopsis)}, ${q(s.subEpisodes)}, ${q(s.dubEpisodes)}, ${q(s.status)}, ${q(s.year)}, ${q(s.popularityScore)}, ${q(s.updatedAt)})`,
  )
  .join(',\n') + ';\n\n';

sql += `-- show_genres (join) -------------------------------------------------------
insert into public.show_genres (show_id, genre_id) values
`;
sql += showGenres
  .map((sg) => `  (${q(sg.showId)}, ${q(sg.genreId)})`)
  .join(',\n') + ';\n\n';

sql += `-- episodes -----------------------------------------------------------------
insert into public.episodes (id, show_id, number, title, is_subbed, is_dubbed, air_date, video_url) values
`;
sql += allEpisodes
  .map(
    (e) =>
      `  (${q(e.id)}, ${q(e.showId)}, ${q(e.number)}, ${q(e.title)}, ${q(e.isSubbed)}, ${q(e.isDubbed)}, ${q(e.airDate)}, ${q(e.videoUrl)})`,
  )
  .join(',\n') + ';\n\n';

sql += `-- airing_slots ------------------------------------------------------------
-- Milestone 2: one weekly air slot per currently-airing show (JST source).
-- day_of_week: 0=Monday … 6=Sunday. air_time: 'HH:MM' 24h.
-- FK-safe: shows rows already inserted above.
insert into public.airing_slots (id, show_id, day_of_week, air_time, timezone, season) values
`;
sql += airingSlots
  .map(
    (a) =>
      `  (${q(a.id)}, ${q(a.showId)}, ${q(a.dayOfWeek)}, ${q(a.airTime)}, ${q(a.timezone)}, ${q(a.season)})`,
  )
  .join(',\n') + ';\n\n';

// forum_categories + ad_placements: hand-curated SQL-only blocks, emitted
// verbatim (alignment, on-conflict clauses, and apostrophes preserved).
sql += forumSql.trimEnd() + '\n\n';
sql += adSql.trimEnd() + '\n\n';

sql += `commit;\n`;

writeFileSync(join(ROOT, 'supabase/seed/seed.sql'), sql);

// ---- report --------------------------------------------------------------
console.log('shows:', shows.length);
console.log('genres:', genres.length);
console.log('show_genres links:', showGenres.length);
console.log('episodes:', allEpisodes.length);
console.log('airing slots:', airingSlots.length);
console.log('ad placements (json):', adPlacements.length);
console.log('status breakdown:', shows.reduce((m, s) => ((m[s.status] = (m[s.status] || 0) + 1), m), {}));
console.log('dub=0 count:', shows.filter((s) => s.dubEpisodes === 0).length);
console.log('image hosts:', [...new Set(shows.map((s) => new URL(s.coverImage).host))]);

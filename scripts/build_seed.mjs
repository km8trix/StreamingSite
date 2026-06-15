// Transform Jikan top-anime data into the COORDINATION.md contract shape.
// Produces: src/lib/data/seed.json  AND  supabase/seed/seed.sql
// Run with node. Reads /tmp/jikan_page1.json (already fetched, polite single call).

import { readFileSync, writeFileSync } from 'node:fs';

const ROOT = '/Users/spencer.karrat/Documents/GitHub/StreamingSite';
const raw = JSON.parse(readFileSync('/tmp/jikan_page1.json', 'utf8'));
const anime = raw.data;

// ---- helpers -------------------------------------------------------------

function slugify(s) {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’.,:!?/\\()]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

// Map Jikan status -> contract ShowStatus
function mapStatus(s) {
  if (s === 'Currently Airing') return 'airing';
  if (s === 'Not yet aired') return 'upcoming';
  return 'finished'; // 'Finished Airing'
}

// Deterministic pseudo-random in [0,1) from a string seed (so re-runs are stable).
function seededRand(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // xorshift a couple of times
  h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
  return ((h >>> 0) % 100000) / 100000;
}

// Synthesize a realistic dub episode count from sub count + status.
// Documented rule: upcoming -> 0; otherwise dubbing lags subbing.
// Newer (>= 2024) shows get a smaller fraction; older shows are usually fully dubbed.
function synthDub(subEpisodes, status, year, seed) {
  if (status === 'upcoming' || subEpisodes <= 0) return 0;
  const r = seededRand(seed);
  if (year && year >= 2024) {
    // very new: 0..40% dubbed, sometimes 0
    if (r < 0.35) return 0;
    return Math.max(0, Math.floor(subEpisodes * (0.15 + r * 0.25)));
  }
  if (year && year >= 2022) {
    // recent: ~60-95% dubbed
    return Math.floor(subEpisodes * (0.6 + r * 0.35));
  }
  // older / classic: fully dubbed
  return subEpisodes;
}

// ---- build genres (deduped across all shows) -----------------------------

const genreMap = new Map(); // name -> {id,name,slug}
let genreSeq = 0;
function genreId(name) {
  if (!genreMap.has(name)) {
    genreSeq += 1;
    genreMap.set(name, {
      id: `gen-${String(genreSeq).padStart(3, '0')}`,
      name,
      slug: slugify(name),
    });
  }
  return genreMap.get(name).id;
}

// ---- build shows ---------------------------------------------------------

const usedSlugs = new Set();
function uniqueSlug(base) {
  let s = base || 'show';
  let i = 2;
  while (usedSlugs.has(s)) s = `${base}-${i++}`;
  usedSlugs.add(s);
  return s;
}

const shows = [];
const showGenres = []; // {showId, genreId}
const allEpisodes = []; // flat for sql

// spread updatedAt across the last ~30 days deterministically so the
// "Recently Updated" rail has meaningful ordering.
const NOW = new Date('2026-06-15T12:00:00.000Z').getTime();
const DAY = 24 * 60 * 60 * 1000;

anime.forEach((a, idx) => {
  const title = a.title_english || a.title;
  const slug = uniqueSlug(slugify(title));
  const id = `show-${String(idx + 1).padStart(3, '0')}`;
  const status = mapStatus(a.status);
  const year = a.year ?? (a.aired?.prop?.from?.year ?? null);

  // sub episodes = aired episode count from API. Some shows report null
  // (still airing / unknown) -> fall back to a sane number.
  let subEpisodes = typeof a.episodes === 'number' && a.episodes > 0 ? a.episodes : 0;
  if (subEpisodes === 0 && status === 'airing') subEpisodes = 12; // currently-airing default cour
  if (subEpisodes === 0 && status === 'finished') subEpisodes = 12;

  const dubEpisodes = synthDub(subEpisodes, status, year, id + slug);

  const coverImage = a.images?.jpg?.large_image_url || a.images?.jpg?.image_url;

  const popularityScore = a.members ?? a.scored_by ?? 0;

  // updatedAt: airing shows are "fresher"; spread the rest deterministically.
  const ageDays = status === 'airing'
    ? Math.floor(seededRand(id) * 4)            // 0-3 days ago
    : 2 + Math.floor(seededRand(slug) * 28);    // 2-29 days ago
  const updatedAt = new Date(NOW - ageDays * DAY).toISOString();

  // genres
  const gNames = (a.genres ?? []).map((g) => g.name);
  const genres = gNames.map((n) => {
    genreId(n);
    return genreMap.get(n);
  });
  genres.forEach((g) => showGenres.push({ showId: id, genreId: g.id }));

  // episodes: synthesize an episode list up to subEpisodes (cap for size).
  // air dates count back weekly from the show's updatedAt anchor.
  const epCount = Math.min(subEpisodes, 26);
  const episodes = [];
  const anchor = new Date(updatedAt).getTime();
  for (let n = 1; n <= epCount; n++) {
    const epAir = new Date(anchor - (epCount - n) * 7 * DAY);
    const airDate = status === 'upcoming' ? null : epAir.toISOString().slice(0, 10);
    const ep = {
      id: `${id}-ep-${String(n).padStart(3, '0')}`,
      number: n,
      title: `Episode ${n}`,
      isSubbed: n <= subEpisodes,
      isDubbed: n <= dubEpisodes,
      airDate,
    };
    episodes.push(ep);
    allEpisodes.push({ ...ep, showId: id });
  }

  shows.push({
    id,
    slug,
    title,
    coverImage,
    bannerImage: null, // Jikan provides no wide banner; contract allows null
    subEpisodes,
    dubEpisodes,
    status,
    year,
    synopsis: (a.synopsis || 'No synopsis available.').trim(),
    genres,
    episodes,
    popularityScore,
    updatedAt,
  });
});

const genres = [...genreMap.values()];

// ---- seed.json (full ShowDetail records; data layer derives summaries) ---

const seedJson = {
  generatedAt: new Date('2026-06-15T12:00:00.000Z').toISOString(),
  source: 'Jikan API (api.jikan.moe/v4/top/anime) — MyAnimeList',
  note: 'dubEpisodes are synthesized (see build_seed.mjs synthDub). episodes are synthesized lists; titles/synopses/covers/genres/subEpisodes are real.',
  genres,
  shows,
};

writeFileSync(`${ROOT}/src/lib/data/seed.json`, JSON.stringify(seedJson, null, 2) + '\n');

// ---- seed.sql ------------------------------------------------------------

function q(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  return `'${String(v).replace(/'/g, "''")}'`;
}

let sql = `-- Seed data for the anime streaming catalog.
-- Generated from the Jikan API (MyAnimeList) by scripts/build_seed.mjs.
-- Idempotent: truncates then inserts. Safe to re-run against a live DB.
-- dubEpisodes are synthesized; episode lists are synthesized; everything
-- else (titles, synopses, cover URLs, genres, sub counts) is real Jikan data.

begin;

truncate table public.episodes, public.show_genres, public.shows, public.genres restart identity cascade;

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
insert into public.episodes (id, show_id, number, title, is_subbed, is_dubbed, air_date) values
`;
sql += allEpisodes
  .map(
    (e) =>
      `  (${q(e.id)}, ${q(e.showId)}, ${q(e.number)}, ${q(e.title)}, ${q(e.isSubbed)}, ${q(e.isDubbed)}, ${q(e.airDate)})`,
  )
  .join(',\n') + ';\n\n';

sql += `commit;\n`;

writeFileSync(`${ROOT}/supabase/seed/seed.sql`, sql);

// ---- report --------------------------------------------------------------
console.log('shows:', shows.length);
console.log('genres:', genres.length);
console.log('show_genres links:', showGenres.length);
console.log('episodes:', allEpisodes.length);
console.log('status breakdown:', shows.reduce((m, s) => ((m[s.status] = (m[s.status] || 0) + 1), m), {}));
console.log('sample slugs:', shows.slice(0, 5).map((s) => s.slug).join(', '));
console.log('dub=0 count:', shows.filter((s) => s.dubEpisodes === 0).length);
console.log('image hosts:', [...new Set(shows.map((s) => new URL(s.coverImage).host))]);

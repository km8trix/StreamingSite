// Domain types — the data contract from COORDINATION.md.
// The UI consumes ONLY these shapes; raw Supabase rows never leak past the
// data layer (src/lib/data/shows.ts maps DB rows -> these types).

export type ShowStatus = 'airing' | 'finished' | 'upcoming'

export type Genre = {
  id: string
  name: string
  slug: string
}

export type ShowSummary = {
  id: string
  slug: string
  title: string
  coverImage: string // absolute URL
  subEpisodes: number // drives "SUB n" badge
  dubEpisodes: number // drives "DUB n" badge
  status: ShowStatus
  year: number | null
}

export type Episode = {
  id: string
  number: number
  title: string
  isSubbed: boolean
  isDubbed: boolean
  airDate: string | null // ISO date (YYYY-MM-DD) or null
  videoUrl: string | null // HLS (.m3u8) manifest URL, or null when no source yet
}

export type ShowDetail = ShowSummary & {
  synopsis: string
  bannerImage: string | null
  genres: Genre[]
  episodes: Episode[]
  popularityScore: number
  updatedAt: string // ISO timestamp
}

// ---------------------------------------------------------------------------
// Milestone 2 — schedule + search/filter types
// ---------------------------------------------------------------------------

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6 // 0=Monday … 6=Sunday

export type ScheduleEntry = {
  show: ShowSummary
  dayOfWeek: DayOfWeek
  airTime: string   // 'HH:MM' 24h, in `timezone` (do NOT convert here — UI's job)
  timezone: string  // IANA, e.g. 'Asia/Tokyo'
}

export type ShowSort = 'title' | 'popularity' | 'recent' | 'year'

export type AudioFilter = 'any' | 'sub' | 'dub'

export type ShowFilter = {
  query?: string
  genres?: string[]     // genre slugs; OR semantics (match any selected)
  audio?: AudioFilter   // 'sub' => subEpisodes>0, 'dub' => dubEpisodes>0
  status?: ShowStatus
  year?: number
  sort?: ShowSort       // default 'popularity'
}

export type ShowFilterResult = { shows: ShowSummary[]; total: number }

// A lightweight search-suggestion payload (typeahead). Title-matched over shows,
// returning only the fields the suggestions dropdown needs — no episode counts,
// status, synopsis, etc. Kept small + fast for as-you-type requests.
export type SearchSuggestion = {
  slug: string
  title: string
  coverImage: string // absolute URL
  year: number | null
}

// ---------------------------------------------------------------------------
// Milestone 3 — accounts / profiles
// ---------------------------------------------------------------------------

export type UserRole = 'user' | 'moderator' | 'admin'

export type Profile = {
  id: string // matches auth.users.id (uuid)
  username: string | null
  displayName: string | null
  avatarUrl: string | null
  role: UserRole
  createdAt: string // ISO timestamp
  updatedAt: string // ISO timestamp
}

// getCurrentUser() returns this shape, or null when there is no session.
export type CurrentUser = {
  userId: string
  email: string | null
  profile: Profile | null // null only if the profile row hasn't materialized yet
}

// ---------------------------------------------------------------------------
// Milestone 3 — comments (per-show, one level of threading)
// ---------------------------------------------------------------------------

// The public author info joined from `profiles` for display next to a comment.
export type CommentAuthor = {
  username: string | null
  displayName: string | null
  avatarUrl: string | null
}

// A single comment as the UI consumes it. `parentId` is null for a top-level
// comment, or the id of the top-level comment it replies to. When `isDeleted`
// is true the data layer BLANKS `body` to '' so the UI can render "[deleted]"
// without ever leaking the original text.
export type Comment = {
  id: string
  showId: string
  userId: string
  parentId: string | null
  body: string
  isEdited: boolean
  isDeleted: boolean
  createdAt: string // ISO timestamp
  updatedAt: string // ISO timestamp
  author: CommentAuthor
}

// The threaded shape returned by getComments(): a top-level comment plus its
// replies. Top-level comments come newest-first; `replies` come oldest-first.
export type CommentThread = Comment & {
  replies: Comment[]
}

// ---------------------------------------------------------------------------
// Milestone 3 — forum (categories / threads / posts)
// ---------------------------------------------------------------------------

// The public author info joined from `profiles` for display in the forum
// (shared shape with comments' CommentAuthor).
export type ForumAuthor = {
  username: string | null
  displayName: string | null
  avatarUrl: string | null
}

// A fixed discussion area. Seed-only; never client-writable.
export type ForumCategory = {
  id: string
  name: string
  slug: string
  description: string
  sortOrder: number
}

// A topic inside a category. `author` is the starter's public profile;
// `postCount` is the number of LIVE (non-deleted) posts; `lastActivityAt` is the
// timestamp of the most recent post (bumped by a DB trigger on new post).
export type ForumThread = {
  id: string
  categoryId: string
  userId: string
  title: string
  slug: string
  isPinned: boolean
  isLocked: boolean
  showId: string | null
  createdAt: string // ISO timestamp
  lastActivityAt: string // ISO timestamp
  author: ForumAuthor
  postCount: number
}

// A single message in a thread. When `isDeleted` is true the data layer BLANKS
// `body` to '' so the UI can render "[deleted]" without leaking the original.
export type ForumPost = {
  id: string
  threadId: string
  userId: string
  body: string
  isEdited: boolean
  isDeleted: boolean
  createdAt: string // ISO timestamp
  updatedAt: string // ISO timestamp
  author: ForumAuthor
}

// The shape returned by getThread(): a thread plus its posts (oldest-first).
export type ForumThreadWithPosts = ForumThread & {
  posts: ForumPost[]
}

// ---------------------------------------------------------------------------
// Roadmap — non-invasive advertising (ad placements)
// ---------------------------------------------------------------------------

// One ad creative as the UI consumes it. `placementKey` is the slot it belongs
// to (e.g. 'home-banner', 'grid-native', 'sidebar'). The UI renders it in a
// reserved, fixed-height, clearly-"Sponsored"-labelled in-flow box (no pop-ups /
// interstitials / autoplay / layout shift). The internal counters (impressions /
// clicks / is_active) are NOT exposed to the UI — getAdForPlacement only ever
// returns ACTIVE ads, and tracking goes through recordAdImpression/recordAdClick.
export type AdPlacement = {
  id: string
  placementKey: string
  name: string | null
  imageUrl: string // absolute URL or app-relative
  targetUrl: string // where a click navigates
  altText: string | null
  weight: number // relative selection weight within the slot (> 0)
}

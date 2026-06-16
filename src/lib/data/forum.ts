// forum.ts — Community forum data access + mutations (M3, Feature 3).
//
// READ:
//   listCategories()            -> all categories, sort_order asc.
//   getCategory(slug)           -> one category by slug, or null.
//   listThreads(categoryId)     -> threads in a category, PINNED-FIRST then
//                                  last_activity_at desc, each with author +
//                                  postCount (live, non-deleted posts).
//   getThread(idOrSlug)         -> a thread + its posts (oldest-first), authors
//                                  joined, soft-deleted post bodies BLANKED to ''.
//
// WRITE (Server Actions — auth-gated; user_id always from auth.uid()):
//   createThread(categoryId, title, body) -> creates the thread AND its first
//                                  post; user_id set server-side.
//   replyToThread(threadId, body)         -> adds a post; rejected if the thread
//                                  is locked and the caller is not a moderator.
//   editPost(id, body)                    -> edit your own post (is_edited=true).
//   deletePost(id)                        -> SOFT delete (own post, OR any post
//                                  if moderator); blanks the stored body.
//   pinThread(id, pinned) / lockThread(id, locked) -> MODERATOR-only.
//
// Mod actions pre-check getCurrentUser().profile.role for a friendly early error,
// but the DB is the authoritative guard: RLS gates pin/lock/delete-any via the
// is_moderator() SQL helper (reads the caller's profiles.role, which is not
// client-writable). role is never trusted from the client.
//
// Reads use the COOKIE-BASED getServerClient() so RLS sees the caller's context.
// Raw Supabase rows never leak: map*Row helpers centralize row -> domain.

import { revalidatePath } from 'next/cache'
import { getServerClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { getCurrentUser } from './profiles'
import type {
  ForumAuthor,
  ForumCategory,
  ForumPost,
  ForumThread,
  ForumThreadWithPosts,
} from './types'

const MAX_TITLE_LENGTH = 200
const MAX_BODY_LENGTH = 10000

// ---------------------------------------------------------------------------
// Row shapes + mapping
// ---------------------------------------------------------------------------

type CategoryRow = {
  id: string
  name: string
  slug: string
  description: string
  sort_order: number
}

type AuthorRow = {
  username: string | null
  display_name: string | null
  avatar_url: string | null
}

// forum_posts embeds the post count as an aggregate alias when listing threads.
type ThreadRow = {
  id: string
  category_id: string
  user_id: string
  title: string
  slug: string
  is_pinned: boolean
  is_locked: boolean
  show_id: string | null
  created_at: string
  last_activity_at: string
  author: AuthorRow | AuthorRow[] | null
  // forum_posts ( count ) embed — PostgREST returns [{ count: n }].
  post_count?: { count: number }[] | null
}

type PostRow = {
  id: string
  thread_id: string
  user_id: string
  body: string
  is_edited: boolean
  is_deleted: boolean
  created_at: string
  updated_at: string
  author: AuthorRow | AuthorRow[] | null
}

const THREAD_COLUMNS =
  'id, category_id, user_id, title, slug, is_pinned, is_locked, show_id, ' +
  'created_at, last_activity_at, ' +
  'author:profiles ( username, display_name, avatar_url ), ' +
  'post_count:forum_posts ( count )'

const POST_COLUMNS =
  'id, thread_id, user_id, body, is_edited, is_deleted, created_at, updated_at, ' +
  'author:profiles ( username, display_name, avatar_url )'

function firstAuthor(author: AuthorRow | AuthorRow[] | null): ForumAuthor {
  const a = !author ? null : Array.isArray(author) ? (author[0] ?? null) : author
  return {
    username: a?.username ?? null,
    displayName: a?.display_name ?? null,
    avatarUrl: a?.avatar_url ?? null,
  }
}

function mapCategoryRow(row: CategoryRow): ForumCategory {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    sortOrder: row.sort_order,
  }
}

function mapThreadRow(row: ThreadRow): ForumThread {
  return {
    id: row.id,
    categoryId: row.category_id,
    userId: row.user_id,
    title: row.title,
    slug: row.slug,
    isPinned: row.is_pinned,
    isLocked: row.is_locked,
    showId: row.show_id,
    createdAt: row.created_at,
    lastActivityAt: row.last_activity_at,
    author: firstAuthor(row.author),
    postCount: row.post_count?.[0]?.count ?? 0,
  }
}

/**
 * Map a raw post row -> domain ForumPost. A soft-deleted post has its body
 * BLANKED here (the UI shows "[deleted]"); the original text never leaves the
 * data layer.
 */
function mapPostRow(row: PostRow): ForumPost {
  return {
    id: row.id,
    threadId: row.thread_id,
    userId: row.user_id,
    body: row.is_deleted ? '' : row.body,
    isEdited: row.is_edited,
    isDeleted: row.is_deleted,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    author: firstAuthor(row.author),
  }
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

// Build resilience: forum reads have NO seed (a fresh cloud DB legitimately has
// no categories/threads/posts yet), so each EMPTY fallback is `[]` / `null`. A
// live failure (empty / unmigrated / unreachable DB) MUST NOT throw out of these
// read fns — that would crash a render / `next build`. We log once and fall back.

/** All forum categories, ordered by sort_order asc. `[]` when unconfigured. */
export async function listCategories(): Promise<ForumCategory[]> {
  if (!isSupabaseConfigured()) return []

  try {
    const supabase = await getServerClient()
    const { data, error } = await supabase
      .from('forum_categories')
      .select('id, name, slug, description, sort_order')
      .order('sort_order', { ascending: true })

    if (error) throw error
    return ((data ?? []) as CategoryRow[]).map(mapCategoryRow)
  } catch (err) {
    console.warn('[data] listCategories live query failed, falling back:', err)
    return []
  }
}

/** A single category by slug, or `null` if not found / unconfigured. */
export async function getCategory(slug: string): Promise<ForumCategory | null> {
  if (!isSupabaseConfigured()) return null

  try {
    const supabase = await getServerClient()
    const { data, error } = await supabase
      .from('forum_categories')
      .select('id, name, slug, description, sort_order')
      .eq('slug', slug)
      .maybeSingle()

    if (error) throw error
    if (!data) return null
    return mapCategoryRow(data as CategoryRow)
  } catch (err) {
    console.warn('[data] getCategory live query failed, falling back:', err)
    return null
  }
}

/**
 * Threads in a category, PINNED-FIRST then most-recently-active first. Each
 * thread carries its author + postCount (count of LIVE posts — see note). `[]`
 * when unconfigured.
 *
 * NOTE: the embedded `forum_posts(count)` counts ALL posts including soft-deleted
 * ones; we filter the embed to non-deleted so postCount reflects live posts.
 */
export async function listThreads(categoryId: string): Promise<ForumThread[]> {
  if (!isSupabaseConfigured()) return []

  try {
    const supabase = await getServerClient()
    const { data, error } = await supabase
      .from('forum_threads')
      .select(THREAD_COLUMNS)
      // Count only live posts for postCount.
      .eq('post_count.is_deleted', false)
      .eq('category_id', categoryId)
      .order('is_pinned', { ascending: false })
      .order('last_activity_at', { ascending: false })

    if (error) throw error

    // The aliased embeds defeat the generated row typing, so cast through unknown.
    return ((data ?? []) as unknown as ThreadRow[]).map(mapThreadRow)
  } catch (err) {
    console.warn('[data] listThreads live query failed, falling back:', err)
    return []
  }
}

/**
 * A thread + its posts (oldest-first), each with author. Soft-deleted posts are
 * included with a blanked body + isDeleted:true. Accepts a thread id (uuid) OR a
 * thread slug. Returns `null` when not found / unconfigured.
 */
export async function getThread(
  idOrSlug: string,
): Promise<ForumThreadWithPosts | null> {
  if (!isSupabaseConfigured()) return null

  try {
    const supabase = await getServerClient()

    // A uuid id and a slug never collide; try id first, then slug.
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        idOrSlug,
      )

    // Count only LIVE (non-deleted) posts for postCount, consistent with
    // listThreads — getThread still RETURNS soft-deleted posts (blanked) below,
    // but the numeric postCount must exclude them.
    const query = supabase
      .from('forum_threads')
      .select(THREAD_COLUMNS)
      .eq('post_count.is_deleted', false)

    // slug now has a UNIQUE index, but be robust regardless: order + limit(1) so an
    // unexpected duplicate resolves to one row instead of throwing PGRST116. (id is
    // the primary key, so its branch is inherently single-row.)
    const scoped = isUuid
      ? query.eq('id', idOrSlug)
      : query
          .eq('slug', idOrSlug)
          .order('created_at', { ascending: true })
          .limit(1)

    const { data: threadData, error: threadError } = await scoped.maybeSingle()

    if (threadError) throw threadError
    if (!threadData) return null

    const thread = mapThreadRow(threadData as unknown as ThreadRow)

    const { data: postsData, error: postsError } = await supabase
      .from('forum_posts')
      .select(POST_COLUMNS)
      .eq('thread_id', thread.id)
      .order('created_at', { ascending: true })

    if (postsError) throw postsError

    const posts = ((postsData ?? []) as unknown as PostRow[]).map(mapPostRow)
    return { ...thread, posts }
  } catch (err) {
    console.warn('[data] getThread live query failed, falling back:', err)
    return null
  }
}

// ---------------------------------------------------------------------------
// Mutations (Server Actions) — auth-gated; user_id always = auth.uid()
// ---------------------------------------------------------------------------

export type ForumActionResult = { error?: string }
// createThread returns the new thread's id on success so the UI can navigate.
export type CreateThreadResult = { error?: string; threadId?: string }

function validateTitle(raw: string): { title: string } | { error: string } {
  const title = raw.trim()
  if (title.length < 1) return { error: 'Title cannot be empty.' }
  if (title.length > MAX_TITLE_LENGTH) {
    return { error: `Title must be ${MAX_TITLE_LENGTH} characters or fewer.` }
  }
  return { title }
}

function validateBody(raw: string): { body: string } | { error: string } {
  const body = raw.trim()
  if (body.length < 1) return { error: 'Message cannot be empty.' }
  if (body.length > MAX_BODY_LENGTH) {
    return { error: `Message must be ${MAX_BODY_LENGTH} characters or fewer.` }
  }
  return { body }
}

/** URL-safe slug from a title (lower, ascii word chars, hyphenated, capped). */
function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
  return base || 'thread'
}

// Cap so base + "-<suffix>" never exceeds the 80-char budget slugify() targets.
const MAX_SLUG_LENGTH = 80

/**
 * Resolve a UNIQUE thread slug from a base slug. If the base is free, return it;
 * otherwise append a numeric suffix (`-2`, `-3`, …) until one is free — mirroring
 * how handle_new_user() de-duplicates usernames. The DB's UNIQUE index on
 * forum_threads(slug) is the authoritative guard; this just produces a friendly,
 * collision-free slug up front so the insert succeeds and the slug stays readable.
 * Keeps every candidate URL-safe and within the slug length budget.
 */
async function uniqueThreadSlug(
  supabase: Awaited<ReturnType<typeof getServerClient>>,
  base: string,
): Promise<string> {
  let candidate = base
  let suffix = 1
  // Bounded loop: in practice resolves in 1–2 iterations; the cap is a safety net.
  while (suffix < 1000) {
    const { data, error } = await supabase
      .from('forum_threads')
      .select('id')
      .eq('slug', candidate)
      .limit(1)
      .maybeSingle()
    if (error) throw error
    if (!data) return candidate

    suffix += 1
    const tail = `-${suffix}`
    candidate = `${base.slice(0, MAX_SLUG_LENGTH - tail.length)}${tail}`
  }
  // Extremely unlikely fallback: append a short random fragment to stay unique.
  const tail = `-${Math.random().toString(36).slice(2, 8)}`
  return `${base.slice(0, MAX_SLUG_LENGTH - tail.length)}${tail}`
}

/**
 * Create a new thread in a category, with its first post. Requires a session.
 *
 * user_id is taken from auth.uid() server-side for BOTH the thread and the first
 * post — never from client input (RLS WITH CHECK enforces this at the DB). The
 * thread + first post are created in two writes (Supabase has no multi-statement
 * transaction over PostgREST); if the post insert fails we delete the orphan
 * thread so we never leave a thread with zero posts.
 */
export async function createThread(
  categoryId: string,
  title: string,
  body: string,
): Promise<CreateThreadResult> {
  'use server'
  const current = await getCurrentUser()
  if (!current) return { error: 'You must be signed in to start a thread.' }

  const vTitle = validateTitle(title)
  if ('error' in vTitle) return { error: vTitle.error }
  const vBody = validateBody(body)
  if ('error' in vBody) return { error: vBody.error }

  const supabase = await getServerClient()

  // Validate the category exists (FK would reject anyway, but a clear message is
  // friendlier than a raw constraint error).
  const { data: category } = await supabase
    .from('forum_categories')
    .select('id, slug')
    .eq('id', categoryId)
    .maybeSingle()
  if (!category) return { error: 'That category does not exist.' }

  // De-duplicate the slug before insert so two threads with the same title don't
  // collide (the UNIQUE index on forum_threads(slug) is the authoritative guard).
  const slug = await uniqueThreadSlug(supabase, slugify(vTitle.title))

  const { data: threadRow, error: threadError } = await supabase
    .from('forum_threads')
    .insert({
      category_id: categoryId,
      user_id: current.userId, // authoritative — from the session, not the client
      title: vTitle.title,
      slug,
    })
    .select('id')
    .single()

  if (threadError || !threadRow) {
    return { error: threadError?.message ?? 'Could not create the thread.' }
  }

  const { error: postError } = await supabase.from('forum_posts').insert({
    thread_id: threadRow.id,
    user_id: current.userId,
    body: vBody.body,
  })

  if (postError) {
    // Roll back the orphan thread so we never leave a thread with no posts.
    await supabase.from('forum_threads').delete().eq('id', threadRow.id)
    return { error: postError.message }
  }

  revalidatePath('/forum')
  revalidatePath(`/forum/${category.slug}`)
  return { threadId: threadRow.id }
}

/**
 * Reply to a thread. Requires a session. Rejected if the thread is locked and
 * the caller is not a moderator (RLS enforces this at the DB too — the locked
 * check is in the INSERT policy). user_id from auth.uid() server-side.
 */
export async function replyToThread(
  threadId: string,
  body: string,
): Promise<ForumActionResult> {
  'use server'
  const current = await getCurrentUser()
  if (!current) return { error: 'You must be signed in to reply.' }

  const vBody = validateBody(body)
  if ('error' in vBody) return { error: vBody.error }

  const supabase = await getServerClient()

  // Friendly early check for the locked case (RLS is the authoritative guard).
  const { data: thread } = await supabase
    .from('forum_threads')
    .select('id, slug, is_locked')
    .eq('id', threadId)
    .maybeSingle()
  if (!thread) return { error: 'That thread does not exist.' }

  const isMod =
    current.profile?.role === 'moderator' || current.profile?.role === 'admin'
  if (thread.is_locked && !isMod) {
    return { error: 'This thread is locked.' }
  }

  const { error } = await supabase.from('forum_posts').insert({
    thread_id: threadId,
    user_id: current.userId,
    body: vBody.body,
  })

  if (error) return { error: error.message }

  // last_activity_at is bumped by the DB AFTER INSERT trigger; nothing to do here.
  revalidatePath(`/forum/thread/${threadId}`)
  if (thread.slug) revalidatePath(`/forum/thread/${thread.slug}`)
  return {}
}

/**
 * Edit one of YOUR OWN posts. RLS (auth.uid() = user_id) limits this to your own
 * row; the column-restricted grant means only body / is_edited / is_deleted are
 * writable. Sets is_edited = true. The is_deleted=false guard makes an edit to an
 * already-deleted post no-op (the DB integrity trigger is the authoritative
 * one-way ratchet).
 */
export async function editPost(
  id: string,
  body: string,
): Promise<ForumActionResult> {
  'use server'
  const current = await getCurrentUser()
  if (!current) return { error: 'You must be signed in to edit a post.' }

  const vBody = validateBody(body)
  if ('error' in vBody) return { error: vBody.error }

  const supabase = await getServerClient()
  const { data, error } = await supabase
    .from('forum_posts')
    .update({ body: vBody.body, is_edited: true })
    .eq('id', id)
    .eq('user_id', current.userId)
    .eq('is_deleted', false)
    .select('thread_id')
    .maybeSingle()

  if (error) return { error: error.message }
  if (!data) return { error: 'Post not found or not yours to edit.' }

  revalidatePath(`/forum/thread/${data.thread_id}`)
  return {}
}

/**
 * Soft-delete a post: sets is_deleted = true and blanks the stored body. Allowed
 * for the post's OWNER, or for a MODERATOR on ANY post (the DB RLS policy gates
 * both via auth.uid()=user_id OR is_moderator()). We do NOT scope the update by
 * user_id here precisely so a moderator can delete others' posts; RLS is the
 * authoritative guard.
 */
export async function deletePost(id: string): Promise<ForumActionResult> {
  'use server'
  const current = await getCurrentUser()
  if (!current) return { error: 'You must be signed in to delete a post.' }

  const supabase = await getServerClient()
  // Soft delete: flip is_deleted + blank the body. RLS lets this through only
  // for the owner OR a moderator; a non-owner non-mod update matches 0 rows.
  const { data, error } = await supabase
    .from('forum_posts')
    .update({ is_deleted: true, body: '' })
    .eq('id', id)
    .select('thread_id')
    .maybeSingle()

  if (error) return { error: error.message }
  if (!data) return { error: 'Post not found or not allowed.' }

  revalidatePath(`/forum/thread/${data.thread_id}`)
  return {}
}

// ---------------------------------------------------------------------------
// Moderator actions — pin / lock. RLS gates pin/lock on others' threads to
// moderators via is_moderator(); we also pre-check the profile role for a clear
// early error.
// ---------------------------------------------------------------------------

/** Pin or unpin a thread. Moderator-only (RLS + early role check). */
export async function pinThread(
  id: string,
  pinned: boolean,
): Promise<ForumActionResult> {
  'use server'
  const current = await getCurrentUser()
  if (!current) return { error: 'You must be signed in.' }

  const isMod =
    current.profile?.role === 'moderator' || current.profile?.role === 'admin'
  if (!isMod) return { error: 'Only moderators can pin threads.' }

  const supabase = await getServerClient()
  const { data, error } = await supabase
    .from('forum_threads')
    .update({ is_pinned: pinned })
    .eq('id', id)
    .select('id, category_id')
    .maybeSingle()

  if (error) return { error: error.message }
  if (!data) return { error: 'Thread not found or not allowed.' }

  revalidatePath('/forum')
  revalidatePath(`/forum/thread/${id}`)
  return {}
}

/** Lock or unlock a thread. Moderator-only (RLS + early role check). */
export async function lockThread(
  id: string,
  locked: boolean,
): Promise<ForumActionResult> {
  'use server'
  const current = await getCurrentUser()
  if (!current) return { error: 'You must be signed in.' }

  const isMod =
    current.profile?.role === 'moderator' || current.profile?.role === 'admin'
  if (!isMod) return { error: 'Only moderators can lock threads.' }

  const supabase = await getServerClient()
  const { data, error } = await supabase
    .from('forum_threads')
    .update({ is_locked: locked })
    .eq('id', id)
    .select('id')
    .maybeSingle()

  if (error) return { error: error.message }
  if (!data) return { error: 'Thread not found or not allowed.' }

  revalidatePath(`/forum/thread/${id}`)
  return {}
}

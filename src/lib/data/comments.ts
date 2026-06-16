// comments.ts — Per-show comment data access + mutations (M3, Feature 2).
//
// READ:  getComments(showId) returns the threaded discussion for a show.
//        Top-level comments newest-first; each one's replies oldest-first.
//        Joins `profiles` for author display (username/display name/avatar).
//        Soft-deleted comments are still returned but with `body` BLANKED to ''
//        and `isDeleted: true`, so the UI can render "[deleted]" — the original
//        text never leaves the data layer.
//
// WRITE: addComment / editComment / deleteComment are Server Actions ('use
//        server'). Each:
//          - calls getCurrentUser(); returns { error } when signed out;
//          - sets user_id SERVER-SIDE from auth.uid() (never from client input)
//            — RLS WITH CHECK (user_id = auth.uid()) is the authoritative guard,
//            so a user cannot post as someone else;
//          - validates body length 1..4000;
//          - deleteComment is a SOFT delete (UPDATE is_deleted = true);
//          - revalidates the show's detail page so the new state renders.
//
// Reads use the COOKIE-BASED getServerClient() so they respect auth context
// (comments are public, but staying on the session-aware client keeps the
// caller's RLS context consistent and lets future per-user features layer in).
//
// Raw Supabase rows never leak: mapCommentRow centralizes row -> domain mapping.

import { revalidatePath } from 'next/cache'
import { getServerClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { getCurrentUser } from './profiles'
import type { Comment, CommentThread } from './types'

const MAX_BODY_LENGTH = 4000

// ---------------------------------------------------------------------------
// Row -> domain mapping
// ---------------------------------------------------------------------------

// The shape PostgREST returns for the embedded profiles join. Supabase types a
// to-one embed as either an object or null (and, defensively, sometimes an array
// for ambiguous relationships) — we normalize all of those below.
type CommentAuthorRow = {
  username: string | null
  display_name: string | null
  avatar_url: string | null
}

type CommentRow = {
  id: string
  show_id: string
  user_id: string
  parent_id: string | null
  body: string
  is_edited: boolean
  is_deleted: boolean
  created_at: string
  updated_at: string
  author: CommentAuthorRow | CommentAuthorRow[] | null
}

const COMMENT_COLUMNS =
  'id, show_id, user_id, parent_id, body, is_edited, is_deleted, created_at, updated_at, ' +
  'author:profiles ( username, display_name, avatar_url )'

function firstAuthor(
  author: CommentRow['author'],
): CommentAuthorRow | null {
  if (!author) return null
  return Array.isArray(author) ? (author[0] ?? null) : author
}

/**
 * Map a raw comment row -> the domain Comment. A soft-deleted comment has its
 * body BLANKED here (the UI shows "[deleted]"); the original text is never
 * returned to callers.
 */
function mapCommentRow(row: CommentRow): Comment {
  const author = firstAuthor(row.author)
  return {
    id: row.id,
    showId: row.show_id,
    userId: row.user_id,
    parentId: row.parent_id,
    body: row.is_deleted ? '' : row.body,
    isEdited: row.is_edited,
    isDeleted: row.is_deleted,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    author: {
      username: author?.username ?? null,
      displayName: author?.display_name ?? null,
      avatarUrl: author?.avatar_url ?? null,
    },
  }
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/**
 * Threaded comments for a show.
 *
 * Returns an array of top-level comments (parent_id null), NEWEST first, each
 * with a `replies` array of its direct replies, OLDEST first. Joins the author's
 * public profile fields. Soft-deleted comments are included with a blanked body
 * + `isDeleted: true` so the UI can show "[deleted]" while keeping threads
 * coherent (a deleted parent still shows its replies).
 *
 * Returns `[]` when Supabase isn't configured (there is no comment seed; the
 * catalog seed has none).
 */
export async function getComments(showId: string): Promise<CommentThread[]> {
  // No comment seed: the EMPTY fallback is `[]`. A fresh cloud DB legitimately
  // has no comments yet, so a live failure here (empty/unmigrated/unreachable DB)
  // must NOT throw out of this read fn and crash a render — it falls back to [].
  if (!isSupabaseConfigured()) return []

  try {
    const supabase = await getServerClient()
    const { data, error } = await supabase
      .from('comments')
      .select(COMMENT_COLUMNS)
      .eq('show_id', showId)
      .order('created_at', { ascending: true })

    if (error) throw error

    // The aliased embed (`author:profiles(...)`) defeats the generated client's
    // row typing, so we cast through `unknown` to our explicit CommentRow shape
    // (same approach schedule.ts uses for its joined SlotRow).
    const comments = ((data ?? []) as unknown as CommentRow[]).map(mapCommentRow)

    // Build threads. We fetched ascending (oldest-first), which is exactly the
    // order we want for replies; top-level comments are then reversed to
    // newest-first.
    const threadsById = new Map<string, CommentThread>()
    const topLevel: CommentThread[] = []

    for (const c of comments) {
      if (c.parentId === null) {
        const thread: CommentThread = { ...c, replies: [] }
        threadsById.set(c.id, thread)
        topLevel.push(thread)
      }
    }

    for (const c of comments) {
      if (c.parentId !== null) {
        const parent = threadsById.get(c.parentId)
        // A reply whose parent is missing (e.g. parent hard-deleted) is dropped —
        // one level of threading only; we never promote orphans to top-level.
        if (parent) parent.replies.push(c)
      }
    }

    // Top-level newest-first; replies already oldest-first from the asc fetch.
    topLevel.reverse()
    return topLevel
  } catch (err) {
    console.warn('[data] getComments live query failed, falling back:', err)
    return []
  }
}

// ---------------------------------------------------------------------------
// Mutations (Server Actions) — auth-gated; user_id always = auth.uid()
// ---------------------------------------------------------------------------

export type CommentActionResult = { error?: string }

/** Trim + validate a comment body. Returns the trimmed body or an error. */
function validateBody(
  raw: string,
): { body: string } | { error: string } {
  const body = raw.trim()
  if (body.length < 1) return { error: 'Comment cannot be empty.' }
  if (body.length > MAX_BODY_LENGTH) {
    return { error: `Comment must be ${MAX_BODY_LENGTH} characters or fewer.` }
  }
  return { body }
}

/**
 * Look up a show's slug from its id so we can revalidate the right detail page.
 * Best-effort: on any miss/error we fall back to a layout-wide revalidate so the
 * comment still becomes visible.
 */
async function revalidateShow(
  supabase: Awaited<ReturnType<typeof getServerClient>>,
  showId: string,
): Promise<void> {
  const { data } = await supabase
    .from('shows')
    .select('slug')
    .eq('id', showId)
    .maybeSingle()

  if (data?.slug) {
    revalidatePath(`/shows/${data.slug}`)
  } else {
    revalidatePath('/', 'layout')
  }
}

/**
 * Post a comment (or reply) on a show. `parentId` makes it a reply to a
 * top-level comment; omit it for a top-level comment.
 *
 * Requires a session. user_id is taken from auth.uid() server-side and is NEVER
 * read from client input, so a user cannot attribute a comment to anyone else
 * (RLS WITH CHECK enforces this at the DB even against a raw REST insert).
 */
export async function addComment(
  showId: string,
  body: string,
  parentId?: string | null,
): Promise<CommentActionResult> {
  'use server'
  const current = await getCurrentUser()
  if (!current) return { error: 'You must be signed in to comment.' }

  const validated = validateBody(body)
  if ('error' in validated) return { error: validated.error }

  const supabase = await getServerClient()

  // Replies are ONE level deep. If a parentId is supplied, verify it names a
  // TOP-LEVEL comment (parent_id IS NULL) that belongs to THIS show. Otherwise the
  // row would insert fine but getComments would silently drop it (a depth-2 reply
  // is never nested, and a cross-show parent is never matched), so reject up front.
  if (parentId) {
    const { data: parent, error: parentError } = await supabase
      .from('comments')
      .select('id, parent_id, show_id')
      .eq('id', parentId)
      .maybeSingle()

    if (parentError) return { error: parentError.message }
    if (!parent || parent.show_id !== showId || parent.parent_id !== null) {
      return { error: 'You can only reply to a top-level comment on this show.' }
    }
  }

  const { error } = await supabase.from('comments').insert({
    show_id: showId,
    user_id: current.userId, // authoritative — from the validated session, not the client
    parent_id: parentId ?? null,
    body: validated.body,
  })

  if (error) return { error: error.message }

  await revalidateShow(supabase, showId)
  return {}
}

/**
 * Edit one of YOUR OWN comments. RLS (auth.uid() = user_id) guarantees you can
 * only update your own row; the column-restricted grant means only body /
 * is_edited / is_deleted are writable. Sets is_edited = true.
 */
export async function editComment(
  id: string,
  body: string,
): Promise<CommentActionResult> {
  'use server'
  const current = await getCurrentUser()
  if (!current) return { error: 'You must be signed in to edit a comment.' }

  const validated = validateBody(body)
  if ('error' in validated) return { error: validated.error }

  const supabase = await getServerClient()
  // Scope by id AND user_id; RLS also enforces own-row, but this avoids a silent
  // zero-row update masking the wrong-owner case. The `is_deleted=false` guard is
  // defense-in-depth: an edit to an already-deleted comment must no-op (the DB's
  // content-integrity trigger is the authoritative one-way ratchet, but this keeps
  // the action from reporting success on a row it can't actually revive). We fetch
  // show_id back so we can revalidate the correct detail page.
  const { data, error } = await supabase
    .from('comments')
    .update({ body: validated.body, is_edited: true })
    .eq('id', id)
    .eq('user_id', current.userId)
    .eq('is_deleted', false)
    .select('show_id')
    .maybeSingle()

  if (error) return { error: error.message }
  if (!data) return { error: 'Comment not found or not yours to edit.' }

  await revalidateShow(supabase, data.show_id)
  return {}
}

/**
 * Soft-delete one of YOUR OWN comments: sets is_deleted = true and blanks the
 * stored body so the original text is gone, while the row survives to keep reply
 * threads coherent. RLS limits this to your own row.
 */
export async function deleteComment(
  id: string,
): Promise<CommentActionResult> {
  'use server'
  const current = await getCurrentUser()
  if (!current) return { error: 'You must be signed in to delete a comment.' }

  const supabase = await getServerClient()
  // Soft delete: flip is_deleted and BLANK the stored body to '' so the original
  // text is erased at rest (the data layer already blanks deleted bodies on read,
  // and the content-integrity trigger keeps it '' on any later update). The UI
  // renders the literal "[deleted]" from isDeleted, not from this stored value.
  const { data, error } = await supabase
    .from('comments')
    .update({ is_deleted: true, body: '' })
    .eq('id', id)
    .eq('user_id', current.userId)
    .select('show_id')
    .maybeSingle()

  if (error) return { error: error.message }
  if (!data) return { error: 'Comment not found or not yours to delete.' }

  await revalidateShow(supabase, data.show_id)
  return {}
}

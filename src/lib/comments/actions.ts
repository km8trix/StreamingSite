'use server'

// Client-importable entry point for the comment server actions.
//
// `src/lib/data/comments.ts` is a regular module (its functions carry inline
// 'use server' directives, but the file itself imports `next/cache` and the
// server Supabase client at module scope). Importing it — or the `@/lib/data`
// barrel that re-exports it — from a Client Component drags those server-only
// modules into the client bundle and breaks the build.
//
// This is a TOP-LEVEL 'use server' module that DEFINES thin async wrappers
// delegating to the data layer. Importing these from a Client Component produces
// server-action references (not a code import), so the server-only imports stay
// on the server — the same pattern the auth UI uses with `@/lib/auth/actions`.
// A bare `export { … } from …` re-export does NOT register as actions here, so
// each must be a real `async function` declaration.
//
// The actual logic (auth gate, server-side user_id, validation, revalidation)
// lives in the data layer; these only forward arguments.

import {
  addComment as addCommentImpl,
  deleteComment as deleteCommentImpl,
  editComment as editCommentImpl,
} from '@/lib/data/comments'
import type { CommentActionResult } from '@/lib/data/comments'
import { rateLimitAction } from '@/lib/rate-limit-action'
import { RATE_LIMITS } from '@/lib/rate-limit-rules'

export async function addComment(
  showId: string,
  body: string,
  parentId?: string | null,
): Promise<CommentActionResult> {
  const limited = await rateLimitAction(RATE_LIMITS.commentCreate)
  if (limited) return limited
  return addCommentImpl(showId, body, parentId)
}

export async function editComment(
  id: string,
  body: string,
): Promise<CommentActionResult> {
  const limited = await rateLimitAction(RATE_LIMITS.commentMutate)
  if (limited) return limited
  return editCommentImpl(id, body)
}

export async function deleteComment(
  id: string,
): Promise<CommentActionResult> {
  const limited = await rateLimitAction(RATE_LIMITS.commentMutate)
  if (limited) return limited
  return deleteCommentImpl(id)
}

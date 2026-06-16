'use server'

// Client-importable entry point for the forum server actions.
//
// `src/lib/data/forum.ts` is a regular module (its action functions carry inline
// 'use server' directives, but the file imports `next/cache` and the server
// Supabase client at module scope). Importing it — or the `@/lib/data` barrel
// that re-exports it — from a Client Component drags those server-only modules
// into the client bundle and breaks the build.
//
// This is a TOP-LEVEL 'use server' module that DEFINES thin async wrappers
// delegating to the data layer. Importing these from a Client Component produces
// server-action references (not a code import), so the server-only imports stay
// on the server — the same pattern the auth + comments UIs use. A bare
// `export { … } from …` re-export does NOT register as actions here, so each
// must be a real `async function` declaration.
//
// The actual logic (auth gate, server-side user_id, validation, lock check,
// moderator gating, revalidation) lives in the data layer; these only forward.

import {
  createThread as createThreadImpl,
  deletePost as deletePostImpl,
  editPost as editPostImpl,
  lockThread as lockThreadImpl,
  pinThread as pinThreadImpl,
  replyToThread as replyToThreadImpl,
} from '@/lib/data/forum'
import type {
  CreateThreadResult,
  ForumActionResult,
} from '@/lib/data/forum'

export async function createThread(
  categoryId: string,
  title: string,
  body: string,
): Promise<CreateThreadResult> {
  return createThreadImpl(categoryId, title, body)
}

export async function replyToThread(
  threadId: string,
  body: string,
): Promise<ForumActionResult> {
  return replyToThreadImpl(threadId, body)
}

export async function editPost(
  id: string,
  body: string,
): Promise<ForumActionResult> {
  return editPostImpl(id, body)
}

export async function deletePost(id: string): Promise<ForumActionResult> {
  return deletePostImpl(id)
}

export async function pinThread(
  id: string,
  pinned: boolean,
): Promise<ForumActionResult> {
  return pinThreadImpl(id, pinned)
}

export async function lockThread(
  id: string,
  locked: boolean,
): Promise<ForumActionResult> {
  return lockThreadImpl(id, locked)
}

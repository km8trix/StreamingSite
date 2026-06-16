import Link from 'next/link'
import { MessagesSquare } from 'lucide-react'
import { getComments, getCurrentUser } from '@/lib/data'
import type { Comment, CommentThread } from '@/lib/data'
import { CommentComposer } from './CommentComposer'
import { CommentItem } from './CommentItem'

/**
 * CommentsSection — the per-show discussion. Async Server Component:
 *   - fetches the threaded comments (getComments) and the viewer (getCurrentUser)
 *     server-side;
 *   - renders the composer when signed in, or a "Sign in to comment" prompt when
 *     not (auth-gated);
 *   - lists top-level comments newest-first, each with its replies nested one
 *     level (oldest-first) — exactly the order the data layer returns.
 *
 * Owner-only edit/delete affordances live on CommentItem and are gated by
 * comparing each comment's userId to the current user's id. Soft-deleted comments
 * arrive with a blanked body + isDeleted=true and render as "[deleted]".
 *
 * Pass the show's `id` (e.g. "show-001"), not its slug.
 */
export async function CommentsSection({ showId }: { showId: string }) {
  const [threads, user] = await Promise.all([
    getComments(showId),
    getCurrentUser(),
  ])

  const currentUserId = user?.userId ?? null
  const isSignedIn = currentUserId !== null

  // Count every comment (top-level + replies), excluding soft-deleted ones, for
  // the section heading.
  const total = threads.reduce(
    (sum, t) =>
      sum +
      (t.isDeleted ? 0 : 1) +
      t.replies.filter((r) => !r.isDeleted).length,
    0,
  )

  return (
    <section
      aria-labelledby="comments-heading"
      data-testid="comments-section"
      className="flex flex-col gap-5"
    >
      <div className="flex items-center gap-2">
        <MessagesSquare className="size-5 text-accent-strong" aria-hidden />
        <h2 id="comments-heading" className="text-lg font-bold text-foreground">
          Comments
          <span className="ml-2 text-sm font-normal text-subtle">{total}</span>
        </h2>
      </div>

      {/* Composer — auth-gated. */}
      {isSignedIn ? (
        <CommentComposer showId={showId} />
      ) : (
        <SignInPrompt />
      )}

      {/* Thread list. */}
      {threads.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-card/40 px-4 py-8 text-center text-sm text-subtle">
          No comments yet. {isSignedIn ? 'Be the first to comment!' : 'Sign in to start the conversation.'}
        </p>
      ) : (
        <ul className="flex flex-col gap-6">
          {threads.map((thread) => (
            <li key={thread.id}>
              <ThreadView
                thread={thread}
                currentUserId={currentUserId}
                showId={showId}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** One top-level comment plus its nested replies (one level). */
function ThreadView({
  thread,
  currentUserId,
  showId,
}: {
  thread: CommentThread
  currentUserId: string | null
  showId: string
}) {
  return (
    <div className="flex flex-col gap-4">
      <CommentItem
        comment={thread}
        isOwner={ownsComment(thread, currentUserId)}
        // Only signed-in users can reply; replies attach to the top-level comment.
        canReply={currentUserId !== null}
        showId={showId}
      />

      {thread.replies.length > 0 && (
        <ul className="ml-5 flex flex-col gap-4 border-l border-border pl-4 sm:ml-6 sm:pl-5">
          {thread.replies.map((reply) => (
            <li key={reply.id}>
              <CommentItem
                comment={reply}
                isOwner={ownsComment(reply, currentUserId)}
                // One level of threading only: no reply-to-a-reply.
                canReply={false}
                showId={showId}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** A deleted comment is never "owned" for affordance purposes. */
function ownsComment(comment: Comment, currentUserId: string | null): boolean {
  return (
    !comment.isDeleted &&
    currentUserId !== null &&
    comment.userId === currentUserId
  )
}

function SignInPrompt() {
  return (
    <div
      data-testid="comments-signin-prompt"
      className="flex flex-col items-start gap-3 rounded-xl border border-border bg-card/60 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-sm text-muted">
        Join the conversation — sign in to leave a comment.
      </p>
      <Link
        href="/signin"
        className="inline-flex shrink-0 items-center rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition-all hover:bg-accent-strong hover:shadow-[0_8px_24px_-8px_rgba(139,92,246,0.7)] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-background"
      >
        Sign in to comment
      </Link>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { MessageSquare, Pencil } from 'lucide-react'
import type { Comment } from '@/lib/data'
import { UserAvatar } from './UserAvatar'
import { CommentComposer } from './CommentComposer'
import { CommentEditForm } from './CommentEditForm'
import { CommentDeleteButton } from './CommentDeleteButton'
import { formatRelativeTime } from '@/lib/relativeTime'
import { cn } from '@/lib/utils'

/**
 * CommentItem — a single comment (top-level or reply) with its metadata and the
 * owner-only edit/delete affordances. Client component because it owns the local
 * "editing" / "replying" UI toggles; all mutations route through server actions.
 *
 * Props are plain serializable data passed from the CommentsSection server
 * component:
 *   - `comment`   the comment to render (body already blanked if soft-deleted)
 *   - `isOwner`   whether the current viewer authored this comment
 *   - `canReply`  whether a reply composer should be offered (top-level only;
 *                 one level of threading). A signed-out viewer gets no composer.
 *   - `showId`    the show id, for the reply composer's addComment call
 */
export function CommentItem({
  comment,
  isOwner,
  canReply,
  showId,
}: {
  comment: Comment
  isOwner: boolean
  canReply: boolean
  showId: string
}) {
  const [editing, setEditing] = useState(false)
  const [replying, setReplying] = useState(false)

  const authorName =
    comment.author.displayName?.trim() ||
    comment.author.username?.trim() ||
    'Anonymous'
  const handle = comment.author.username?.trim()

  const deleted = comment.isDeleted

  return (
    <article
      data-testid="comment-item"
      data-comment-id={comment.id}
      className="flex gap-3"
    >
      <UserAvatar
        avatarUrl={deleted ? null : comment.author.avatarUrl}
        name={authorName}
        size={36}
        className="mt-0.5"
      />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span
            data-testid="comment-author"
            className={cn(
              'text-sm font-semibold',
              deleted ? 'text-subtle' : 'text-foreground',
            )}
          >
            {deleted ? 'Anonymous' : authorName}
          </span>
          {!deleted && handle && (
            <span className="text-xs text-subtle">@{handle}</span>
          )}
          <span className="text-xs text-subtle" title={comment.createdAt}>
            {formatRelativeTime(comment.createdAt)}
          </span>
          {!deleted && comment.isEdited && (
            <span className="text-xs italic text-subtle">(edited)</span>
          )}
        </div>

        {editing && !deleted ? (
          <CommentEditForm
            commentId={comment.id}
            initialBody={comment.body}
            onCancel={() => setEditing(false)}
            onDone={() => setEditing(false)}
          />
        ) : (
          <p
            data-testid="comment-body"
            className={cn(
              'mt-1 whitespace-pre-line break-words text-sm leading-relaxed',
              deleted ? 'italic text-subtle' : 'text-muted',
            )}
          >
            {deleted ? '[deleted]' : comment.body}
          </p>
        )}

        {/* Action row — hidden while editing and for deleted comments. */}
        {!deleted && !editing && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            {canReply && (
              <button
                type="button"
                onClick={() => setReplying((v) => !v)}
                data-testid="comment-reply"
                aria-expanded={replying}
                className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-subtle transition-colors hover:bg-card hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-background"
              >
                <MessageSquare className="size-3.5" aria-hidden />
                Reply
              </button>
            )}
            {isOwner && (
              <>
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  data-testid="comment-edit"
                  className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-subtle transition-colors hover:bg-card hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-background"
                >
                  <Pencil className="size-3.5" aria-hidden />
                  Edit
                </button>
                <CommentDeleteButton commentId={comment.id} />
              </>
            )}
          </div>
        )}

        {/* Reply composer (top-level only). */}
        {replying && canReply && (
          <div className="mt-2">
            <CommentComposer
              showId={showId}
              parentId={comment.id}
              placeholder={`Reply to ${authorName}…`}
              submitLabel="Reply"
              autoFocus
              compact
              onPosted={() => setReplying(false)}
            />
          </div>
        )}
      </div>
    </article>
  )
}

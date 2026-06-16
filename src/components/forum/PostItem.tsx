'use client'

import { useState } from 'react'
import { Pencil } from 'lucide-react'
import type { ForumPost } from '@/lib/data'
import { UserAvatar } from '@/components/UserAvatar'
import { formatRelativeTime } from '@/lib/relativeTime'
import { cn } from '@/lib/utils'
import { PostEditForm } from './PostEditForm'
import { PostDeleteButton } from './PostDeleteButton'

/**
 * PostItem — one post in a thread, with author metadata and the owner/moderator
 * edit/delete affordances. Client component because it owns the local "editing"
 * toggle; all mutations route through server actions. Renders post text as TEXT
 * (no dangerouslySetInnerHTML).
 *
 * Props are plain serializable data from the thread page server component:
 *   - `post`        the post (body already blanked to '' when soft-deleted)
 *   - `canEdit`     whether the viewer may edit this post (owner only)
 *   - `canDelete`   whether the viewer may soft-delete it (owner OR moderator)
 *   - `isOriginalPost`  marks the thread's first post for a subtle "OP" tag
 */
export function PostItem({
  post,
  canEdit,
  canDelete,
  isOriginalPost = false,
}: {
  post: ForumPost
  canEdit: boolean
  canDelete: boolean
  isOriginalPost?: boolean
}) {
  const [editing, setEditing] = useState(false)

  const authorName =
    post.author.displayName?.trim() ||
    post.author.username?.trim() ||
    'Anonymous'
  const handle = post.author.username?.trim()
  const deleted = post.isDeleted
  const showActions = !deleted && !editing && (canEdit || canDelete)

  return (
    <article
      data-testid="post-item"
      data-post-id={post.id}
      className="flex gap-3 rounded-2xl border border-border bg-surface/40 p-4"
    >
      <UserAvatar
        avatarUrl={deleted ? null : post.author.avatarUrl}
        name={authorName}
        size={40}
        className="mt-0.5"
      />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span
            data-testid="post-author"
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
          {isOriginalPost && (
            <span className="rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-strong">
              OP
            </span>
          )}
          <span className="text-xs text-subtle" title={post.createdAt}>
            {formatRelativeTime(post.createdAt)}
          </span>
          {!deleted && post.isEdited && (
            <span className="text-xs italic text-subtle">(edited)</span>
          )}
        </div>

        {editing && !deleted ? (
          <PostEditForm
            postId={post.id}
            initialBody={post.body}
            onCancel={() => setEditing(false)}
            onDone={() => setEditing(false)}
          />
        ) : (
          <p
            data-testid="post-body"
            className={cn(
              'mt-1.5 whitespace-pre-line break-words text-sm leading-relaxed',
              deleted ? 'italic text-subtle' : 'text-muted',
            )}
          >
            {deleted ? '[deleted]' : post.body}
          </p>
        )}

        {showActions && (
          <div className="mt-2 flex flex-wrap items-center gap-1">
            {canEdit && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                data-testid="post-edit"
                className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-subtle transition-colors hover:bg-card hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-background"
              >
                <Pencil className="size-3.5" aria-hidden />
                Edit
              </button>
            )}
            {canDelete && <PostDeleteButton postId={post.id} />}
          </div>
        )}
      </div>
    </article>
  )
}

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Lock, Pin } from 'lucide-react'
import { getCurrentUser, getThread, listCategories } from '@/lib/data'
import { PostItem } from '@/components/forum/PostItem'
import { ReplyComposer } from '@/components/forum/ReplyComposer'
import { ThreadModControls } from '@/components/forum/ThreadModControls'

type Params = { id: string }

// Reads the session cookie (getCurrentUser) + live posts per request.
export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>
}): Promise<Metadata> {
  const { id } = await params
  const thread = await getThread(id)
  if (!thread) return { title: 'Thread not found' }
  return { title: `${thread.title} — Forum` }
}

export default async function ThreadPage({
  params,
}: {
  params: Promise<Params>
}) {
  const { id } = await params

  const [thread, user, categories] = await Promise.all([
    getThread(id),
    getCurrentUser(),
    listCategories(),
  ])
  if (!thread) notFound()

  // Resolve the thread's category for the breadcrumb (slug-linked back-path).
  const category = categories.find((c) => c.id === thread.categoryId) ?? null

  const currentUserId = user?.userId ?? null
  const isSignedIn = currentUserId !== null
  const role = user?.profile?.role
  const isModerator = role === 'moderator' || role === 'admin'

  // The thread's first post (oldest) is the original post.
  const originalPostId = thread.posts[0]?.id ?? null

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <nav
        aria-label="Breadcrumb"
        className="mb-3 flex items-center text-xs text-subtle"
      >
        <Link href="/forum" className="hover:text-foreground">
          Forum
        </Link>
        {category && (
          <>
            <span className="mx-1.5" aria-hidden>
              /
            </span>
            <Link
              href={`/forum/${category.slug}`}
              className="hover:text-foreground"
            >
              {category.name}
            </Link>
          </>
        )}
        <span className="mx-1.5" aria-hidden>
          /
        </span>
        <span
          className="max-w-[55vw] truncate text-muted sm:max-w-md"
          aria-current="page"
        >
          {thread.title}
        </span>
      </nav>

      <header className="mb-5 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {thread.isPinned && (
            <span
              data-testid="thread-pinned"
              className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-accent-strong"
            >
              <Pin className="size-3.5" aria-hidden />
              Pinned
            </span>
          )}
          {thread.isLocked && (
            <span
              data-testid="thread-locked"
              className="inline-flex items-center gap-1 rounded-full bg-card px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-subtle ring-1 ring-inset ring-border"
            >
              <Lock className="size-3.5" aria-hidden />
              Locked
            </span>
          )}
        </div>
        <h1 className="text-balance text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
          {thread.title}
        </h1>

        {/* Moderator-only pin/lock toggles. */}
        {isModerator && (
          <ThreadModControls
            threadId={thread.id}
            isPinned={thread.isPinned}
            isLocked={thread.isLocked}
          />
        )}
      </header>

      {/* Posts (oldest-first). */}
      <ul data-testid="thread-posts" className="flex flex-col gap-3">
        {thread.posts.map((post) => {
          const isOwner =
            !post.isDeleted &&
            currentUserId !== null &&
            post.userId === currentUserId
          return (
            <li key={post.id}>
              <PostItem
                post={post}
                canEdit={isOwner}
                // Owner OR moderator may soft-delete; a deleted post has no actions.
                canDelete={!post.isDeleted && (isOwner || isModerator)}
                isOriginalPost={post.id === originalPostId}
              />
            </li>
          )
        })}
      </ul>

      {/* Reply area — auth-gated; disabled with a notice when locked. */}
      <div className="mt-6 border-t border-border pt-6">
        {!isSignedIn ? (
          <SignInPrompt />
        ) : thread.isLocked && !isModerator ? (
          <p
            data-testid="thread-locked-notice"
            className="flex items-center gap-2 rounded-xl border border-border bg-card/60 px-4 py-4 text-sm text-muted"
          >
            <Lock className="size-4 shrink-0 text-subtle" aria-hidden />
            This thread is locked. New replies are disabled.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {thread.isLocked && isModerator && (
              <p className="text-xs text-subtle">
                This thread is locked — replying as a moderator.
              </p>
            )}
            <ReplyComposer threadId={thread.id} />
          </div>
        )}
      </div>
    </div>
  )
}

function SignInPrompt() {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-border bg-card/60 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted">Sign in to join the discussion.</p>
      <Link
        href="/signin"
        className="inline-flex shrink-0 items-center rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition-all hover:bg-accent-strong hover:shadow-[0_8px_24px_-8px_rgba(139,92,246,0.7)] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-background"
      >
        Sign in to reply
      </Link>
    </div>
  )
}

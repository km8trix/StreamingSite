import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Lock, MessageSquare, Pin } from 'lucide-react'
import {
  getCategory,
  getCurrentUser,
  listThreads,
} from '@/lib/data'
import type { ForumThread } from '@/lib/data'
import { UserAvatar } from '@/components/UserAvatar'
import { NewThreadForm } from '@/components/forum/NewThreadForm'
import { formatRelativeTime } from '@/lib/relativeTime'

type Params = { category: string }

// Reads the session cookie (getCurrentUser) + live thread list per request.
export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>
}): Promise<Metadata> {
  const { category: slug } = await params
  const category = await getCategory(slug)
  if (!category) return { title: 'Category not found' }
  return {
    title: `${category.name} — Forum`,
    description: category.description,
  }
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<Params>
}) {
  const { category: slug } = await params

  const category = await getCategory(slug)
  if (!category) notFound()

  const [threads, user] = await Promise.all([
    listThreads(category.id),
    getCurrentUser(),
  ])
  const isSignedIn = user !== null

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <nav aria-label="Breadcrumb" className="mb-3 text-xs text-subtle">
        <Link href="/forum" className="hover:text-foreground">
          Forum
        </Link>
        <span className="mx-1.5" aria-hidden>
          /
        </span>
        <span className="text-muted">{category.name}</span>
      </nav>

      <header className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
          {category.name}
        </h1>
        {category.description && (
          <p className="mt-1 text-sm text-muted">{category.description}</p>
        )}
      </header>

      {/* New thread — auth-gated. */}
      <div className="mb-6">
        {isSignedIn ? (
          <NewThreadForm categoryId={category.id} />
        ) : (
          <SignInPrompt />
        )}
      </div>

      {threads.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-card/40 px-4 py-12 text-center text-sm text-subtle">
          No threads yet.{' '}
          {isSignedIn
            ? 'Start the first conversation!'
            : 'Sign in to start the first conversation.'}
        </p>
      ) : (
        <ul
          data-testid="thread-list"
          className="flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface/40"
        >
          {threads.map((thread) => (
            <li key={thread.id}>
              <ThreadRow thread={thread} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ThreadRow({ thread }: { thread: ForumThread }) {
  const authorName =
    thread.author.displayName?.trim() ||
    thread.author.username?.trim() ||
    'Anonymous'
  const replyCount = Math.max(thread.postCount - 1, 0)

  return (
    <Link
      href={`/forum/thread/${thread.id}`}
      data-testid="thread-row"
      data-thread-id={thread.id}
      className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-card/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
    >
      <UserAvatar
        avatarUrl={thread.author.avatarUrl}
        name={authorName}
        size={36}
        className="shrink-0"
      />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {thread.isPinned && (
            <span
              data-testid="thread-pinned"
              className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-strong"
            >
              <Pin className="size-3" aria-hidden />
              Pinned
            </span>
          )}
          {thread.isLocked && (
            <span
              data-testid="thread-locked"
              className="inline-flex items-center gap-1 rounded-full bg-card px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-subtle ring-1 ring-inset ring-border"
            >
              <Lock className="size-3" aria-hidden />
              Locked
            </span>
          )}
          <span className="truncate text-sm font-semibold text-foreground">
            {thread.title}
          </span>
        </div>
        <p className="mt-0.5 truncate text-xs text-subtle">
          by {authorName} · {formatRelativeTime(thread.lastActivityAt)}
        </p>
      </div>

      <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-subtle">
        <MessageSquare className="size-3.5" aria-hidden />
        {replyCount}
      </span>
    </Link>
  )
}

function SignInPrompt() {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-border bg-card/60 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted">
        Have something to discuss? Sign in to start a thread.
      </p>
      <Link
        href="/signin"
        className="inline-flex shrink-0 items-center rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition-all hover:bg-accent-strong hover:shadow-[0_8px_24px_-8px_rgba(139,92,246,0.7)] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-background"
      >
        Sign in to post
      </Link>
    </div>
  )
}

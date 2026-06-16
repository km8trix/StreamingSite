import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, MessagesSquare } from 'lucide-react'
import { listCategories, listThreads } from '@/lib/data'

export const metadata: Metadata = {
  title: 'Forum',
  description: 'Community discussion — categories, threads, and replies.',
}

// Reads the session cookie indirectly through the data layer's server client and
// reflects live forum state on each request.
export const dynamic = 'force-dynamic'

export default async function ForumPage() {
  const categories = await listCategories()

  // Thread counts per category (one query each; the category set is tiny — 4
  // seeded). Done in parallel so the page stays fast.
  const counts = await Promise.all(
    categories.map(async (c) => (await listThreads(c.id)).length),
  )
  const threadCounts = new Map(categories.map((c, i) => [c.id, counts[i]]))

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 flex items-center gap-3">
        <MessagesSquare className="size-7 text-accent-strong" aria-hidden />
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
            Forum
          </h1>
          <p className="mt-0.5 text-sm text-muted">
            Talk anime with the community.
          </p>
        </div>
      </header>

      {categories.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-card/40 px-4 py-12 text-center text-sm text-subtle">
          No categories yet.
        </p>
      ) : (
        <ul
          data-testid="forum-categories"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        >
          {categories.map((category) => {
            const count = threadCounts.get(category.id) ?? 0
            return (
              <li key={category.id}>
                <Link
                  href={`/forum/${category.slug}`}
                  data-testid="category-card"
                  data-category-slug={category.slug}
                  className="group flex h-full flex-col gap-2 rounded-2xl border border-border bg-surface/60 p-5 transition-all hover:border-accent/50 hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-background"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-lg font-bold text-foreground transition-colors group-hover:text-accent-strong">
                      {category.name}
                    </h2>
                    <ArrowRight
                      className="mt-1 size-4 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-accent-strong"
                      aria-hidden
                    />
                  </div>
                  <p className="flex-1 text-sm leading-relaxed text-muted">
                    {category.description}
                  </p>
                  <span className="text-xs font-medium text-subtle">
                    {count} {count === 1 ? 'thread' : 'threads'}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

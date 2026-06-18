import type { Metadata } from 'next'
import { getNews } from '@/lib/data'
import { NewsCard } from '@/components/NewsCard'

export const metadata: Metadata = {
  title: 'News',
  description:
    'The latest anime news and headlines from around the web — new series, industry updates, manga, and more. Each story links to its original source.',
}

// News is shared content (not per-user), so render it statically and refresh via
// ISR — the Jikan fetch's own `revalidate` then shares the upstream calls across
// requests. (force-dynamic would disable that fetch cache and refetch per request.)
export const revalidate = 1800

export default async function NewsPage() {
  const articles = await getNews()

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
          News
        </h1>
        <p className="mt-1 text-sm text-muted">
          The latest anime headlines from around the web. Each story links to its
          original source.
        </p>
      </div>

      {articles.length === 0 ? (
        <p
          data-testid="news-empty"
          className="rounded-card border border-dashed border-border bg-card/40 px-4 py-16 text-center text-sm text-muted"
        >
          No news right now. Check back soon.
        </p>
      ) : (
        <ol data-testid="news-list" className="flex flex-col gap-3">
          {articles.map((article) => (
            <li key={article.id}>
              <NewsCard article={article} />
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

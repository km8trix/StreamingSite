import type { Metadata } from 'next'
import { getNews } from '@/lib/data'
import { NewsCard } from '@/components/NewsCard'

export const metadata: Metadata = {
  title: 'News',
  description:
    'The latest anime news and headlines — new series, industry updates, manga, box office, and events.',
}

// Curated headlines / live data; don't statically cache.
export const dynamic = 'force-dynamic'

export default async function NewsPage() {
  const articles = await getNews()
  const [featured, ...rest] = articles

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
          News
        </h1>
        <p className="mt-1 text-sm text-muted">
          The latest anime headlines. Each story links to its original source.
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
        <div className="flex flex-col gap-6">
          <NewsCard article={featured} featured />
          {rest.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((article) => (
                <NewsCard key={article.id} article={article} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

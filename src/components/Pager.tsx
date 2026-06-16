import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Pager — server-rendered pagination for the catalog grids (Browse / Genre).
 * Renders nothing when everything fits on one page, so it's dormant until the
 * catalog outgrows CATALOG_PAGE_SIZE. `hrefFor(page)` builds each page's URL
 * (preserving the current filters); passed from the page since both are server
 * components (no client boundary).
 */
export function Pager({
  page,
  total,
  perPage,
  hrefFor,
}: {
  page: number
  total: number
  perPage: number
  hrefFor: (page: number) => string
}) {
  const pageCount = Math.max(1, Math.ceil(total / perPage))
  if (pageCount <= 1) return null

  const prev = page > 1 ? page - 1 : null
  const next = page < pageCount ? page + 1 : null
  const items = pageWindow(page, pageCount)

  return (
    <nav
      aria-label="Pagination"
      data-testid="pager"
      className="mt-8 flex items-center justify-center gap-1"
    >
      <Edge href={prev ? hrefFor(prev) : null} label="Previous page">
        <ChevronLeft className="size-4" aria-hidden />
      </Edge>

      {items.map((it, i) =>
        it === '…' ? (
          <span key={`gap-${i}`} className="px-2 text-subtle" aria-hidden>
            …
          </span>
        ) : (
          <Link
            key={it}
            href={hrefFor(it)}
            aria-label={`Page ${it}`}
            aria-current={it === page ? 'page' : undefined}
            className={cn(
              'grid size-9 place-items-center rounded-full text-sm font-medium transition-colors',
              it === page
                ? 'bg-accent text-accent-foreground'
                : 'text-muted hover:bg-card hover:text-foreground',
            )}
          >
            {it}
          </Link>
        ),
      )}

      <Edge href={next ? hrefFor(next) : null} label="Next page">
        <ChevronRight className="size-4" aria-hidden />
      </Edge>
    </nav>
  )
}

/** Prev/Next control — a real link when navigable, a disabled span at the ends. */
function Edge({
  href,
  label,
  children,
}: {
  href: string | null
  label: string
  children: React.ReactNode
}) {
  const base =
    'grid size-9 place-items-center rounded-full text-sm transition-colors'
  if (!href) {
    return (
      <span
        aria-disabled="true"
        aria-label={`${label} (unavailable)`}
        className={cn(base, 'cursor-not-allowed text-subtle/40')}
      >
        {children}
      </span>
    )
  }
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(base, 'text-muted hover:bg-card hover:text-foreground')}
    >
      {children}
    </Link>
  )
}

/**
 * Compact page list: first, last, current ±1, with '…' gaps. e.g. for page 6 of
 * 12 → [1, …, 5, 6, 7, …, 12].
 */
function pageWindow(page: number, pageCount: number): (number | '…')[] {
  const wanted = new Set<number>([1, pageCount, page, page - 1, page + 1])
  const sorted = [...wanted]
    .filter((p) => p >= 1 && p <= pageCount)
    .sort((a, b) => a - b)

  const out: (number | '…')[] = []
  let prev = 0
  for (const p of sorted) {
    if (prev && p - prev > 1) out.push('…')
    out.push(p)
    prev = p
  }
  return out
}

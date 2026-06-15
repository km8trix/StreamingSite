import { Search } from 'lucide-react'

/**
 * SearchPlaceholder — visually-present but non-functional search field. Search
 * is a later milestone, so this is disabled and labelled "coming soon" to set
 * expectations without shipping dead behavior. Stays a Server Component (no
 * interactivity); the input is genuinely disabled.
 */
export function SearchPlaceholder({ className }: { className?: string }) {
  return (
    <div className={className} title="Search is coming soon">
      <label htmlFor="site-search" className="sr-only">
        Search shows (coming soon)
      </label>
      <div className="relative flex items-center">
        <Search
          className="pointer-events-none absolute left-3 size-4 text-subtle"
          aria-hidden
        />
        <input
          id="site-search"
          type="search"
          disabled
          aria-disabled="true"
          placeholder="Search — coming soon"
          data-testid="search-placeholder"
          className="w-full cursor-not-allowed rounded-full border border-border bg-card/60 py-2 pl-9 pr-3 text-sm text-muted placeholder:text-subtle disabled:opacity-80"
        />
      </div>
    </div>
  )
}

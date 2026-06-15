'use client'

import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'

/**
 * HeaderSearch — functional search input that navigates to /search?q=…
 * on submit. Replaces the now-deprecated SearchPlaceholder (which was a
 * disabled input). Client component because it needs access to the router.
 */
export function HeaderSearch({ className }: { className?: string }) {
  const router = useRouter()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const q = (fd.get('q') as string | null)?.trim() ?? ''
    if (q) {
      router.push(`/search?q=${encodeURIComponent(q)}`)
    } else {
      router.push('/search')
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      role="search"
      className={className}
    >
      <label htmlFor="site-search" className="sr-only">
        Search shows
      </label>
      <div className="relative flex items-center">
        <Search
          className="pointer-events-none absolute left-3 size-4 text-subtle"
          aria-hidden
        />
        <input
          id="site-search"
          name="q"
          type="search"
          autoComplete="off"
          placeholder="Search shows…"
          data-testid="search-input"
          className="w-full rounded-full border border-border bg-card/60 py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-subtle transition-colors hover:border-border-strong focus:border-accent focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-background"
        />
      </div>
    </form>
  )
}

'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useCallback } from 'react'
import type { Genre, AudioFilter, ShowStatus, ShowSort } from '@/lib/data'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'

/**
 * Current filter selections, parsed from the URL on the server and passed in
 * as a prop. Keeping these out of a client useSearchParams() call is what makes
 * the panel interactive on a hard load with query params: a useSearchParams()
 * read inside a Suspense boundary on a dynamic page leaves the component's
 * router instance unable to navigate after hydration.
 */
export interface FilterValues {
  q: string
  genres: string[]
  audio: AudioFilter
  status: ShowStatus | ''
  year: string
  sort: ShowSort
}

/**
 * FilterPanel — URL-synced filter controls for the catalog pages (/shows and
 * /genre/[slug]). All state lives in the URL query string; changing any control
 * calls router.push() with the updated params, which re-renders the server page.
 *
 * The current selections come in as `values` (parsed on the server) and the
 * router is used purely for navigation — the component never reads
 * useSearchParams() itself.
 */
export function FilterPanel({
  genres,
  years,
  values,
}: {
  genres: Genre[]
  years: number[]
  values: FilterValues
}) {
  const router = useRouter()
  const pathname = usePathname()

  // Current filter values, derived on the server from the URL.
  const currentQ = values.q
  const currentGenres = values.genres
  const currentAudio = values.audio
  const currentStatus = values.status
  const currentYear = values.year
  const currentSort = values.sort

  /**
   * Navigate to a filtered URL on the current catalog route (pathname is
   * whichever page mounted the panel — /shows or /genre/[slug]).
   *
   * Why the empty `?` suffix: these dynamic routes are also prefetched as a bare
   * static entry (e.g. `/shows`). Under the App Router, a `router.push('/shows')`
   * from a deep-linked URL (e.g. `/shows?audio=dub`) is deduped against that
   * prefetched bare entry and silently no-ops — the Clear button and "reset to
   * defaults" cases would do nothing. Pushing `/shows?` instead makes the
   * destination href distinct from the cached entry, so the navigation commits
   * and the server re-renders with the new (empty) search params. Next normalizes
   * the trailing `?` out of the visible URL. URLs that already carry a query
   * string navigate normally and are pushed unchanged.
   */
  const navigate = useCallback(
    (target: string) => {
      router.push(target.includes('?') ? target : `${target}?`)
    },
    [router],
  )

  /**
   * Build the next query string from the current values plus the requested
   * updates, then push to the router. Rebuilding from props (not from
   * useSearchParams) keeps navigation working on a hard-loaded, param'd URL.
   */
  const push = useCallback(
    (updates: Record<string, string | string[] | null>) => {
      const params = new URLSearchParams()
      // Seed with the current selections so unchanged filters are preserved.
      if (currentQ) params.set('q', currentQ)
      if (currentGenres.length > 0) params.set('genres', currentGenres.join(','))
      if (currentAudio !== 'any') params.set('audio', currentAudio)
      if (currentStatus !== '') params.set('status', currentStatus)
      if (currentYear !== '') params.set('year', currentYear)
      if (currentSort !== 'popularity') params.set('sort', currentSort)

      for (const [key, val] of Object.entries(updates)) {
        params.delete(key)
        if (val === null) continue
        if (Array.isArray(val)) {
          if (val.length > 0) params.set(key, val.join(','))
        } else if (val !== '') {
          params.set(key, val)
        }
      }
      const qs = params.toString()
      navigate(`${pathname}${qs ? `?${qs}` : ''}`)
    },
    [
      navigate,
      pathname,
      currentQ,
      currentGenres,
      currentAudio,
      currentStatus,
      currentYear,
      currentSort,
    ],
  )

  function toggleGenre(slug: string) {
    const next = currentGenres.includes(slug)
      ? currentGenres.filter((g) => g !== slug)
      : [...currentGenres, slug]
    push({ genres: next })
  }

  function clearAll() {
    const params = new URLSearchParams()
    if (currentQ) params.set('q', currentQ)
    navigate(`${pathname}${params.toString() ? `?${params.toString()}` : ''}`)
  }

  const hasFilters =
    currentGenres.length > 0 ||
    currentAudio !== 'any' ||
    currentStatus !== '' ||
    currentYear !== '' ||
    currentSort !== 'popularity'

  return (
    <aside
      data-testid="filter-panel"
      className="flex flex-col gap-5 rounded-card border border-border bg-card/40 p-4"
      aria-label="Filter and sort shows"
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">Filters</h2>
        {hasFilters && (
          <button
            type="button"
            onClick={clearAll}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:bg-card hover:text-foreground"
          >
            <X className="size-3" aria-hidden />
            Clear
          </button>
        )}
      </div>

      {/* Sort */}
      <fieldset>
        <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
          Sort by
        </legend>
        <div className="flex flex-col gap-1" data-testid="filter-sort">
          {(
            [
              { value: 'popularity', label: 'Popularity' },
              { value: 'title', label: 'Title A–Z' },
              { value: 'recent', label: 'Recently Updated' },
              { value: 'year', label: 'Year (Newest)' },
            ] as { value: ShowSort; label: string }[]
          ).map(({ value, label }) => (
            <label
              key={value}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent has-[:focus-visible]:ring-offset-1 has-[:focus-visible]:ring-offset-background',
                currentSort === value
                  ? 'bg-accent/10 text-accent-strong'
                  : 'text-muted hover:bg-card hover:text-foreground',
              )}
            >
              <input
                type="radio"
                name="sort"
                value={value}
                checked={currentSort === value}
                onChange={() => push({ sort: value })}
                className="peer sr-only"
              />
              <span
                className={cn(
                  'flex size-3.5 shrink-0 items-center justify-center rounded-full border',
                  currentSort === value
                    ? 'border-accent bg-accent'
                    : 'border-border-strong',
                )}
                aria-hidden
              >
                {currentSort === value && (
                  <span className="size-1.5 rounded-full bg-white" />
                )}
              </span>
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      {/* Audio */}
      <fieldset>
        <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
          Audio
        </legend>
        <div className="flex gap-1.5" data-testid="filter-audio">
          {(
            [
              { value: 'any', label: 'Any' },
              { value: 'sub', label: 'SUB' },
              { value: 'dub', label: 'DUB' },
            ] as { value: AudioFilter; label: string }[]
          ).map(({ value, label }) => (
            <label key={value}>
              <input
                type="radio"
                name="audio"
                value={value}
                checked={currentAudio === value}
                onChange={() => push({ audio: value })}
                className="peer sr-only"
              />
              <span
                className={cn(
                  'inline-flex cursor-pointer select-none items-center rounded-full border px-3 py-1 text-xs font-semibold transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background',
                  currentAudio === value
                    ? value === 'sub'
                      ? 'border-sub bg-sub text-sub-foreground'
                      : value === 'dub'
                        ? 'border-dub bg-dub text-dub-foreground'
                        : 'border-accent bg-accent/20 text-accent-strong'
                    : 'border-border text-muted hover:border-border-strong hover:text-foreground',
                )}
              >
                {label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Status */}
      <fieldset>
        <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
          Status
        </legend>
        <div className="flex flex-col gap-1" data-testid="filter-status">
          {(
            [
              { value: '', label: 'All' },
              { value: 'airing', label: 'Airing' },
              { value: 'finished', label: 'Finished' },
              { value: 'upcoming', label: 'Upcoming' },
            ] as { value: ShowStatus | ''; label: string }[]
          ).map(({ value, label }) => (
            <label
              key={value || 'all'}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent has-[:focus-visible]:ring-offset-1 has-[:focus-visible]:ring-offset-background',
                currentStatus === value
                  ? 'bg-accent/10 text-accent-strong'
                  : 'text-muted hover:bg-card hover:text-foreground',
              )}
            >
              <input
                type="radio"
                name="status"
                value={value}
                checked={currentStatus === value}
                onChange={() => push({ status: value || null })}
                className="peer sr-only"
              />
              <span
                className={cn(
                  'flex size-3.5 shrink-0 items-center justify-center rounded-full border',
                  currentStatus === value
                    ? 'border-accent bg-accent'
                    : 'border-border-strong',
                )}
                aria-hidden
              >
                {currentStatus === value && (
                  <span className="size-1.5 rounded-full bg-white" />
                )}
              </span>
              {value === 'airing' && (
                <span className="relative mr-0.5 flex size-1.5 shrink-0">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-airing opacity-75" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-airing" />
                </span>
              )}
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      {/* Year */}
      {years.length > 0 && (
        <div>
          <label
            htmlFor="filter-year"
            className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted"
          >
            Year
          </label>
          <select
            id="filter-year"
            data-testid="filter-year"
            value={currentYear}
            onChange={(e) => push({ year: e.target.value || null })}
            className="w-full rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground transition-colors hover:border-border-strong focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-background"
          >
            <option value="">All years</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Genres */}
      {genres.length > 0 && (
        <fieldset>
          <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
            Genres
          </legend>
          <div className="flex flex-wrap gap-1.5" data-testid="filter-genre">
            {genres.map((genre) => {
              const active = currentGenres.includes(genre.slug)
              return (
                <label key={genre.id}>
                  <input
                    type="checkbox"
                    value={genre.slug}
                    checked={active}
                    onChange={() => toggleGenre(genre.slug)}
                    className="peer sr-only"
                  />
                  <span
                    className={cn(
                      'inline-flex cursor-pointer select-none items-center rounded-full border px-2.5 py-1 text-xs font-medium transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background',
                      active
                        ? 'border-accent/60 bg-accent/15 text-accent-strong'
                        : 'border-border text-muted hover:border-border-strong hover:text-foreground',
                    )}
                  >
                    {genre.name}
                  </span>
                </label>
              )
            })}
          </div>
        </fieldset>
      )}
    </aside>
  )
}

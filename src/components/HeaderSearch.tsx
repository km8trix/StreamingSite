'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Loader2, Search } from 'lucide-react'
import type { SearchSuggestion } from '@/lib/data'
import { cn } from '@/lib/utils'

/**
 * HeaderSearch — accessible as-you-type combobox typeahead for the site header.
 *
 * Behavior:
 *  - As the user types (>=2 trimmed chars) it fetches GET
 *    /api/search/suggestions?q=… (debounced ~200ms) and shows a dropdown of
 *    matching shows (cover thumbnail + title + year). Below 2 chars the dropdown
 *    is hidden and no request is made.
 *  - Submitting the form (Enter with no active option, or pressing the search
 *    icon button) navigates to the catalog at /shows?q=… (the single browse +
 *    search surface; /search redirects there).
 *  - Arrow keys move the active option; Enter on an active option goes to
 *    /shows/<slug>; Escape closes the dropdown; clicking a suggestion navigates.
 *
 * Race-safety: every keystroke aborts the previous in-flight request and the
 * resolved payload is also matched against the query it was issued for, so a
 * slow earlier response can never overwrite newer suggestions.
 *
 * Accessibility: a WAI-ARIA combobox — the input carries role="combobox",
 * aria-expanded, aria-controls, aria-autocomplete="list", and
 * aria-activedescendant; the dropdown is role="listbox" with role="option"
 * children, each with a stable id and aria-selected on the active one. A polite
 * live region announces the result count.
 *
 * Client component (interactive). Fetches the route handler — it never imports
 * @/lib/data, keeping the data layer behind the clean HTTP boundary.
 */

const DEBOUNCE_MS = 200
const MIN_QUERY_LEN = 2

export function HeaderSearch({ className }: { className?: string }) {
  const router = useRouter()

  // useId gives each rendered instance (desktop + mobile both mount) a unique,
  // SSR-stable id namespace so aria-controls / option ids never collide.
  const baseId = useId()
  const listboxId = `${baseId}-listbox`
  const statusId = `${baseId}-status`
  const optionId = (index: number) => `${baseId}-option-${index}`
  const inputId = `${baseId}-input`

  const [value, setValue] = useState('')
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  // -1 means "no active option" (Enter then submits the full search).
  const [activeIndex, setActiveIndex] = useState(-1)
  // Distinguishes "no matches" (searched, 2+ chars, empty result) from the
  // initial / too-short state where we show nothing.
  const [searched, setSearched] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // The query the most recent request was issued for — guards against
  // out-of-order responses overwriting newer state.
  const latestQueryRef = useRef('')

  const closeDropdown = useCallback(() => {
    setOpen(false)
    setActiveIndex(-1)
  }, [])

  const resetSuggestions = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setSuggestions([])
    setSearched(false)
    setLoading(false)
    closeDropdown()
  }, [closeDropdown])

  const fetchSuggestions = useCallback(async (query: string) => {
    // Abort any in-flight request before starting a new one (race-safety).
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    latestQueryRef.current = query

    setLoading(true)
    try {
      const res = await fetch(
        `/api/search/suggestions?q=${encodeURIComponent(query)}`,
        { signal: controller.signal },
      )
      // Drop stale responses: if the query has moved on, ignore this payload.
      if (latestQueryRef.current !== query) return
      if (!res.ok) {
        setSuggestions([])
        setSearched(true)
        setActiveIndex(-1)
        setOpen(true)
        return
      }
      const data = (await res.json()) as { suggestions?: SearchSuggestion[] }
      if (latestQueryRef.current !== query) return
      const next = Array.isArray(data.suggestions) ? data.suggestions : []
      setSuggestions(next)
      setSearched(true)
      setActiveIndex(-1)
      setOpen(true)
    } catch (err) {
      // Aborted requests are expected on every keystroke — swallow them. Any
      // other failure simply yields no suggestions (the form still submits).
      if ((err as Error)?.name === 'AbortError') return
      if (latestQueryRef.current !== query) return
      setSuggestions([])
      setSearched(true)
      setActiveIndex(-1)
      setOpen(true)
    } finally {
      if (latestQueryRef.current === query) setLoading(false)
    }
  }, [])

  // Debounced effect: schedule a fetch for the current (>=2 char) query. The
  // too-short / reset path is handled in handleChange (an event handler) so this
  // effect never calls setState synchronously in its body.
  useEffect(() => {
    const trimmed = value.trim()
    if (trimmed.length < MIN_QUERY_LEN) return

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      void fetchSuggestions(trimmed)
    }, DEBOUNCE_MS)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [value, fetchSuggestions])

  // Cleanup on unmount: cancel any pending timer / request.
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      abortRef.current?.abort()
    }
  }, [])

  // Close on outside click.
  useEffect(() => {
    if (!open) return
    function onPointerDown(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        closeDropdown()
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open, closeDropdown])

  function submitFullSearch() {
    const q = value.trim()
    closeDropdown()
    inputRef.current?.blur()
    router.push(q ? `/shows?q=${encodeURIComponent(q)}` : '/shows')
  }

  function goToSuggestion(s: SearchSuggestion) {
    closeDropdown()
    setValue('')
    resetSuggestions()
    inputRef.current?.blur()
    router.push(`/shows/${s.slug}`)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value
    setValue(next)
    // When the query falls below the minimum, hide the dropdown and cancel any
    // in-flight request immediately (the debounced effect only handles fetching
    // for valid-length queries).
    if (next.trim().length < MIN_QUERY_LEN) {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      resetSuggestions()
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    // Enter with an active option is handled in onKeyDown; a plain submit (icon
    // button, or Enter with no active option) runs the full-text search.
    if (open && activeIndex >= 0 && suggestions[activeIndex]) {
      goToSuggestion(suggestions[activeIndex])
      return
    }
    submitFullSearch()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const hasOptions = open && suggestions.length > 0

    switch (e.key) {
      case 'ArrowDown': {
        if (!hasOptions) {
          // Re-open the dropdown if we have results but it was closed.
          if (suggestions.length > 0) setOpen(true)
          return
        }
        e.preventDefault()
        setActiveIndex((i) => (i + 1) % suggestions.length)
        break
      }
      case 'ArrowUp': {
        if (!hasOptions) return
        e.preventDefault()
        setActiveIndex((i) =>
          i <= 0 ? suggestions.length - 1 : i - 1,
        )
        break
      }
      case 'Enter': {
        // Let the form's onSubmit handle navigation (it reads activeIndex).
        // No preventDefault here so the <form> submit fires naturally.
        break
      }
      case 'Escape': {
        if (open) {
          e.preventDefault()
          closeDropdown()
        }
        break
      }
      case 'Home': {
        if (hasOptions) {
          e.preventDefault()
          setActiveIndex(0)
        }
        break
      }
      case 'End': {
        if (hasOptions) {
          e.preventDefault()
          setActiveIndex(suggestions.length - 1)
        }
        break
      }
      default:
        break
    }
  }

  const trimmed = value.trim()
  const showEmpty =
    open && searched && !loading && trimmed.length >= MIN_QUERY_LEN && suggestions.length === 0
  const showList = open && suggestions.length > 0
  const isExpanded = showList || showEmpty
  const activeDescendant =
    showList && activeIndex >= 0 ? optionId(activeIndex) : undefined

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <form onSubmit={handleSubmit} role="search">
        <label htmlFor={inputId} className="sr-only">
          Search shows
        </label>
        <div className="relative flex items-center">
          <button
            type="submit"
            aria-label="Search"
            className="absolute left-1.5 flex size-7 items-center justify-center rounded-full text-subtle transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Search className="size-4" aria-hidden />
          </button>
          <input
            ref={inputRef}
            id={inputId}
            name="q"
            type="text"
            role="combobox"
            autoComplete="off"
            aria-autocomplete="list"
            aria-expanded={isExpanded}
            aria-controls={isExpanded ? listboxId : undefined}
            aria-activedescendant={activeDescendant}
            aria-describedby={statusId}
            placeholder="Search shows…"
            data-testid="search-input"
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (suggestions.length > 0 || showEmpty) setOpen(true)
            }}
            className="w-full rounded-full border border-border bg-card/60 py-2 pl-9 pr-9 text-sm text-foreground placeholder:text-subtle transition-colors hover:border-border-strong focus:border-accent focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-background"
          />
          {loading && (
            <Loader2
              className="absolute right-3 size-4 animate-spin text-subtle motion-reduce:animate-none"
              aria-hidden
              data-testid="search-loading"
            />
          )}
        </div>
      </form>

      {/* Polite live region announcing result counts to assistive tech. */}
      <div id={statusId} role="status" aria-live="polite" className="sr-only">
        {showList
          ? `${suggestions.length} suggestion${suggestions.length === 1 ? '' : 's'} available.`
          : showEmpty
            ? 'No matches.'
            : ''}
      </div>

      {/* Anchored dropdown — absolutely positioned so it never shifts the header
          layout. Rendered only when open (list or empty state). */}
      {isExpanded && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-border bg-surface shadow-2xl">
          {showList ? (
            <ul
              id={listboxId}
              role="listbox"
              aria-label="Show suggestions"
              data-testid="search-suggestions"
              className="max-h-[min(70vh,24rem)] overflow-y-auto py-1"
            >
              {suggestions.map((s, index) => {
                const active = index === activeIndex
                return (
                  <li
                    key={s.slug}
                    id={optionId(index)}
                    role="option"
                    aria-selected={active}
                    data-testid="search-suggestion"
                    data-slug={s.slug}
                    // onMouseDown (not onClick) so it fires before the input's
                    // blur closes the dropdown.
                    onMouseDown={(e) => {
                      e.preventDefault()
                      goToSuggestion(s)
                    }}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 px-3 py-2 text-sm transition-colors',
                      active ? 'bg-card text-foreground' : 'text-muted',
                    )}
                  >
                    <span className="relative h-14 w-10 shrink-0 overflow-hidden rounded bg-card">
                      <Image
                        src={s.coverImage}
                        alt=""
                        fill
                        sizes="40px"
                        className="object-cover"
                      />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-medium text-foreground">
                        {s.title}
                      </span>
                      <span className="text-xs text-subtle">
                        {s.year ?? '—'}
                      </span>
                    </span>
                  </li>
                )
              })}
            </ul>
          ) : (
            // Empty (no-matches) state. Keep the listbox id present so
            // aria-controls always resolves to a live element.
            <div
              id={listboxId}
              role="listbox"
              aria-label="Show suggestions"
              data-testid="search-suggestions-empty"
              className="px-3 py-4 text-sm text-subtle"
            >
              No matches
            </div>
          )}
        </div>
      )}
    </div>
  )
}

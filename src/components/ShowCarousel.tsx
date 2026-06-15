'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { ShowSummary } from '@/lib/data'
import { cn } from '@/lib/utils'
import { ShowCard } from './ShowCard'

/**
 * ShowCarousel — horizontally-scrollable rail of ShowCards for the home page.
 *
 * Client component (scroll buttons + arrow-state) that receives plain
 * serializable data (ShowSummary[]) as props — the page that renders it stays
 * a Server Component. Keyboard accessible: cards are real links and the rail
 * itself is focusable/scrollable; arrow buttons are supplementary.
 */
export function ShowCarousel({
  shows,
  title,
  id,
  priorityFirst = false,
}: {
  shows: ShowSummary[]
  title: string
  id?: string
  priorityFirst?: boolean
}) {
  const scrollerRef = useRef<HTMLUListElement>(null)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)
  const headingId = id ?? title.toLowerCase().replace(/\s+/g, '-')

  const updateArrows = useCallback(() => {
    const el = scrollerRef.current
    if (!el) return
    const { scrollLeft, scrollWidth, clientWidth } = el
    setCanLeft(scrollLeft > 4)
    setCanRight(scrollLeft + clientWidth < scrollWidth - 4)
  }, [])

  useEffect(() => {
    updateArrows()
    const el = scrollerRef.current
    if (!el) return
    el.addEventListener('scroll', updateArrows, { passive: true })
    window.addEventListener('resize', updateArrows)
    return () => {
      el.removeEventListener('scroll', updateArrows)
      window.removeEventListener('resize', updateArrows)
    }
  }, [updateArrows, shows.length])

  const scrollBy = (dir: 1 | -1) => {
    const el = scrollerRef.current
    if (!el) return
    el.scrollBy({ left: dir * Math.round(el.clientWidth * 0.85), behavior: 'smooth' })
  }

  if (shows.length === 0) return null

  return (
    <section aria-labelledby={headingId} className="group/rail relative">
      <div className="mb-3 flex items-end justify-between gap-4">
        <h2
          id={headingId}
          className="text-lg font-bold tracking-tight text-foreground sm:text-xl"
        >
          {title}
        </h2>
        <div className="hidden items-center gap-2 sm:flex">
          <RailButton
            direction="left"
            disabled={!canLeft}
            onClick={() => scrollBy(-1)}
          />
          <RailButton
            direction="right"
            disabled={!canRight}
            onClick={() => scrollBy(1)}
          />
        </div>
      </div>

      <ul
        ref={scrollerRef}
        className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-pl-1 pb-2"
        data-testid="carousel-scroller"
      >
        {shows.map((show, i) => (
          <li
            key={show.id}
            className="w-[44vw] shrink-0 snap-start sm:w-44 lg:w-48"
          >
            <ShowCard
              show={show}
              priority={priorityFirst && i < 3}
              sizes="(min-width: 1024px) 192px, (min-width: 640px) 176px, 44vw"
            />
          </li>
        ))}
      </ul>
    </section>
  )
}

function RailButton({
  direction,
  disabled,
  onClick,
}: {
  direction: 'left' | 'right'
  disabled: boolean
  onClick: () => void
}) {
  const Icon = direction === 'left' ? ChevronLeft : ChevronRight
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={direction === 'left' ? 'Scroll left' : 'Scroll right'}
      className={cn(
        'flex size-8 items-center justify-center rounded-full border border-border bg-surface text-muted transition-colors',
        'hover:border-accent/60 hover:text-foreground',
        'disabled:cursor-not-allowed disabled:opacity-30',
      )}
    >
      <Icon className="size-4" aria-hidden />
    </button>
  )
}

'use client'

import {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Play } from 'lucide-react'
import type { ScheduleEntry, DayOfWeek } from '@/lib/data'
import { cn } from '@/lib/utils'

/**
 * ScheduleGrid — the Release Schedule day-PICKER.
 *
 * A rolling strip of day tabs (abbreviated month+day on top, weekday below)
 * with ‹ › week paging and a live "Now" clock; selecting a day shows that day's
 * releases as a list (time · title · estimated "Episode N" play pill) with a
 * Show-more toggle. Replaces the old fixed Mon→Sun 7-column grid.
 *
 * Client-only date/clock: rendered behind a mount gate (useSyncExternalStore so
 * the server snapshot is "not mounted") — SSR shows a skeleton and the real,
 * viewer-local schedule fills in after hydration, avoiding date/clock hydration
 * mismatches. DayOfWeek convention: 0=Monday … 6=Sunday (ISO week).
 */

const ALL_DAYS: DayOfWeek[] = [0, 1, 2, 3, 4, 5, 6]
const VISIBLE_DAYS = 7 // tabs shown per page
const MAX_WEEKS_AHEAD = 4 // how far forward ‹ › can page
const LIST_LIMIT = 8 // rows before "Show more"

/** Convert a JST 'HH:MM' string + IANA timezone to viewer-local time display. */
function jstToLocalTime(airTime: string, sourceTimezone: string): string {
  const [hStr, mStr] = airTime.split(':')
  const hours = parseInt(hStr, 10)
  const minutes = parseInt(mStr, 10)

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const day = now.getDate()

  const srcFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: sourceTimezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  const utcMidnight = Date.UTC(year, month - 1, day, hours, minutes, 0)
  const testDate = new Date(utcMidnight)
  const parts = srcFormatter.formatToParts(testDate)
  const srcHour = parseInt(parts.find((p) => p.type === 'hour')!.value, 10)
  const srcMin = parseInt(parts.find((p) => p.type === 'minute')!.value, 10)

  const wantMinutes = hours * 60 + minutes
  const gotMinutes = srcHour * 60 + srcMin
  const deltaMs = (wantMinutes - gotMinutes) * 60 * 1000
  const airDate = new Date(testDate.getTime() + deltaMs)

  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(airDate)
}

// --- mount gate: false on the server, true on the client (no setState/effect) -
const subscribeNoop = () => () => {}
const getMountedSnapshot = () => true
const getMountedServerSnapshot = () => false
function useMounted(): boolean {
  return useSyncExternalStore(
    subscribeNoop,
    getMountedSnapshot,
    getMountedServerSnapshot,
  )
}

type DayInfo = {
  key: string
  isoDay: DayOfWeek
  monthDay: string // "Jun 17"
  weekdayShort: string // "Wed"
  isToday: boolean
}

/** A page of `count` consecutive days starting `offsetDays` from today. */
function buildDays(offsetDays: number, count: number): DayInfo[] {
  const now = new Date()
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const out: DayInfo[] = []
  for (let i = 0; i < count; i++) {
    const d = new Date(
      base.getFullYear(),
      base.getMonth(),
      base.getDate() + offsetDays + i,
    )
    out.push({
      key: d.toISOString().slice(0, 10),
      isoDay: (((d.getDay() + 6) % 7) as DayOfWeek),
      monthDay: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      weekdayShort: d.toLocaleDateString('en-US', { weekday: 'short' }),
      isToday: offsetDays + i === 0,
    })
  }
  return out
}

export function ScheduleGrid({ entries }: { entries: ScheduleEntry[] }) {
  const mounted = useMounted()
  const [weekOffset, setWeekOffset] = useState(0) // 0 … MAX_WEEKS_AHEAD
  const [selected, setSelected] = useState(0) // index within the visible week

  // Live clock (client-only; suppressHydrationWarning covers the SSR snapshot).
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  // Group entries by ISO weekday, each sorted by source air time (chronological).
  const byDay = useMemo(() => {
    const m = new Map<DayOfWeek, ScheduleEntry[]>()
    for (const d of ALL_DAYS) m.set(d, [])
    for (const e of entries) m.get(e.dayOfWeek)?.push(e)
    for (const [d, list] of m) {
      m.set(d, [...list].sort((a, b) => a.airTime.localeCompare(b.airTime)))
    }
    return m
  }, [entries])

  if (!mounted) return <ScheduleSkeleton />

  const days = buildDays(weekOffset * VISIBLE_DAYS, VISIBLE_DAYS)
  const selectedDay = days[Math.min(selected, days.length - 1)] ?? days[0]
  const dayEntries = byDay.get(selectedDay.isoDay) ?? []

  const pageDays = (delta: number) => {
    setWeekOffset((o) => Math.min(MAX_WEEKS_AHEAD, Math.max(0, o + delta)))
    setSelected(0)
  }

  return (
    <div
      data-testid="schedule-grid"
      className="overflow-hidden rounded-card border border-border bg-card/30"
    >
      {/* Header: live clock + timezone note */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-border px-4 py-3">
        <span className="text-xs text-subtle">
          Times shown in your local timezone (source: JST).
        </span>
        <span className="text-xs tabular-nums text-muted" suppressHydrationWarning>
          Now: {now.toLocaleDateString('en-US')}{' '}
          {now.toLocaleTimeString('en-US')}
        </span>
      </div>

      {/* Day picker: ‹ tabs › */}
      <div className="flex items-stretch gap-1 border-b border-border p-2">
        <ArrowButton
          dir="left"
          disabled={weekOffset === 0}
          onClick={() => pageDays(-1)}
        />
        <div
          role="tablist"
          aria-label="Schedule day"
          className="no-scrollbar flex flex-1 gap-1 overflow-x-auto"
        >
          {days.map((d, i) => {
            const isSelected = i === selected
            return (
              <button
                key={d.key}
                type="button"
                role="tab"
                aria-selected={isSelected}
                data-testid="schedule-day-tab"
                data-day={d.isoDay}
                onClick={() => setSelected(i)}
                className={cn(
                  'flex min-w-[3.25rem] flex-1 flex-col items-center rounded-md px-2 py-2 transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                  isSelected ? 'bg-accent/15' : 'hover:bg-card-hover',
                )}
              >
                <span
                  className={cn(
                    'text-[0.625rem] font-semibold uppercase tracking-wider tabular-nums',
                    isSelected ? 'text-accent-strong/80' : 'text-subtle',
                  )}
                >
                  {d.monthDay}
                </span>
                <span
                  className={cn(
                    'text-sm font-extrabold uppercase tracking-wide',
                    isSelected ? 'text-accent-strong' : 'text-muted',
                  )}
                >
                  {d.weekdayShort}
                </span>
                <span
                  className={cn(
                    'mt-1 h-1 w-1 rounded-full',
                    d.isToday ? 'bg-accent' : 'bg-transparent',
                  )}
                  aria-hidden
                />
              </button>
            )
          })}
        </div>
        <ArrowButton
          dir="right"
          disabled={weekOffset >= MAX_WEEKS_AHEAD}
          onClick={() => pageDays(1)}
        />
      </div>

      {/* Selected day's releases (keyed so Show-more resets per day) */}
      <DayList key={`${weekOffset}-${selectedDay.key}`} entries={dayEntries} />
    </div>
  )
}

function DayList({ entries }: { entries: ScheduleEntry[] }) {
  const [expanded, setExpanded] = useState(false)

  if (entries.length === 0) {
    return (
      <p
        data-testid="schedule-empty"
        className="px-4 py-12 text-center text-sm text-subtle"
      >
        No releases scheduled for this day.
      </p>
    )
  }

  const shown = expanded ? entries : entries.slice(0, LIST_LIMIT)

  return (
    <div>
      <ul className="divide-y divide-border/50">
        {shown.map((entry) => (
          <ScheduleRow
            key={`${entry.show.id}-${entry.dayOfWeek}`}
            entry={entry}
          />
        ))}
      </ul>
      {entries.length > LIST_LIMIT && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-full border-t border-border px-4 py-3 text-center text-sm font-medium text-muted transition-colors hover:bg-card-hover hover:text-foreground"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  )
}

function ScheduleRow({ entry }: { entry: ScheduleEntry }) {
  const { show } = entry
  const localTime = jstToLocalTime(entry.airTime, entry.timezone)
  // Estimated next episode = released count + 1 (this is an estimated schedule).
  const episode = Math.max(show.subEpisodes, show.dubEpisodes) + 1

  return (
    <li>
      <Link
        href={`/shows/${show.slug}`}
        data-testid="schedule-entry"
        className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-card-hover sm:gap-4"
      >
        <span className="w-16 shrink-0 text-sm font-bold tabular-nums text-foreground">
          {localTime}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground group-hover:text-accent-strong">
          {show.title}
        </span>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold text-muted transition-colors group-hover:border-accent/50 group-hover:text-accent-strong">
          <Play className="size-3 fill-current" aria-hidden />
          Episode {episode}
        </span>
      </Link>
    </li>
  )
}

function ArrowButton({
  dir,
  disabled,
  onClick,
}: {
  dir: 'left' | 'right'
  disabled: boolean
  onClick: () => void
}) {
  const Icon = dir === 'left' ? ChevronLeft : ChevronRight
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === 'left' ? 'Previous days' : 'Next days'}
      className={cn(
        'grid w-9 shrink-0 place-items-center rounded-md text-muted transition-colors',
        'hover:bg-card-hover hover:text-foreground',
        'disabled:cursor-not-allowed disabled:opacity-30',
      )}
    >
      <Icon className="size-5" aria-hidden />
    </button>
  )
}

function ScheduleSkeleton() {
  return (
    <div
      data-testid="schedule-grid"
      className="overflow-hidden rounded-card border border-border bg-card/30"
    >
      <div className="border-b border-border px-4 py-3">
        <div className="h-3 w-64 animate-pulse rounded bg-card-hover" />
      </div>
      <div className="flex gap-1 border-b border-border p-2">
        {Array.from({ length: VISIBLE_DAYS }).map((_, i) => (
          <div
            key={i}
            className="h-12 flex-1 animate-pulse rounded-md bg-card-hover"
          />
        ))}
      </div>
      <div className="space-y-px p-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-11 animate-pulse rounded bg-card-hover" />
        ))}
      </div>
    </div>
  )
}

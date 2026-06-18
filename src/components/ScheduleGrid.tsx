'use client'

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ChevronLeft, ChevronRight, Play } from 'lucide-react'
import type { ScheduleEntry, DayOfWeek } from '@/lib/data'
import { SubDubBadges } from './SubDubBadges'
import { cn } from '@/lib/utils'

/**
 * ScheduleGrid — the Release Schedule day timeline (LiveChart-style).
 *
 * A rolling strip of day tabs (abbreviated month+day on top, weekday below) with
 * ‹ › week paging and a "Today" jump; selecting a day shows that day's releases
 * as a chronological timeline. Each row links to the show (poster + title) AND,
 * separately, to that episode (the "EP N" badge deep-links to /shows/{slug}?ep=N).
 * A live countdown chip reads "in 2h 15m 30s" / "Airing now" / "Aired".
 *
 * Timezone model: a slot stores its *JST broadcast* weekday (dayOfWeek, 0=Mon…
 * 6=Sun) + air time. We resolve each slot to a concrete UTC instant from its JST
 * broadcast date, then bucket every occurrence under the **viewer-local calendar
 * day** of that instant — so a 1:00 AM JST Monday slot correctly appears under a
 * US viewer's Sunday, with a matching gutter time and countdown. Gutter time,
 * <time>, and countdown all derive from that one instant, so they always agree.
 *
 * Client-only date/clock: rendered behind a mount gate (useSyncExternalStore so
 * the server snapshot is "not mounted") — SSR shows a skeleton and the real,
 * viewer-local schedule fills in after hydration, avoiding date/clock hydration
 * mismatches.
 */

const VISIBLE_DAYS = 7 // tabs shown per page
const MAX_WEEKS_AHEAD = 4 // how far forward ‹ › can page
const LIST_LIMIT = 8 // rows before "Show more"
// "Airing now" window: from air time through a typical TV episode's runtime
// (before air the chip counts down; after the window it reads "Aired").
const BROADCAST_WINDOW_MS = 24 * 60_000

/**
 * The instant a 'HH:MM' source-timezone air time falls on a given calendar date.
 * `year/month/day` are the source-zone (JST) broadcast date (month is 1-based).
 * We guess the UTC instant, read it back in the source zone, and subtract the
 * *full* offset (date + time) — correcting only HH:MM would drift the instant by
 * a whole day for late air times that cross a UTC date boundary.
 */
function airInstant(
  year: number,
  month: number,
  day: number,
  airTime: string,
  sourceTimezone: string,
): Date {
  const [hStr, mStr] = airTime.split(':')
  const hour = parseInt(hStr, 10)
  const minute = parseInt(mStr, 10)

  const guess = Date.UTC(year, month - 1, day, hour, minute, 0)
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: sourceTimezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  const p = Object.fromEntries(
    dtf.formatToParts(new Date(guess)).map((part) => [part.type, part.value]),
  ) as Record<string, string>

  const asUTC = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour) % 24, // some engines format midnight as "24"
    Number(p.minute),
    Number(p.second),
  )
  const offsetMs = asUTC - guess
  return new Date(guess - offsetMs)
}

function formatLocalTime(instant: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(instant)
}

/** Viewer-local calendar-date key 'Y-M-D' for an instant (or a local Date). */
function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

type Countdown = { text: string; tone: string }

/**
 * Relative time from `now` to an air `instant`, LiveChart-style. Within a day
 * the countdown is LIVE to the second (the parent clock ticks every second), so
 * a show releasing today visibly counts down; further out it stays coarse.
 */
function countdown(instant: Date, now: Date): Countdown {
  const ms = instant.getTime() - now.getTime()

  if (ms > 0) {
    const totalSec = Math.floor(ms / 1000)
    const days = Math.floor(totalSec / 86400)
    const hours = Math.floor((totalSec % 86400) / 3600)
    const mins = Math.floor((totalSec % 3600) / 60)
    const secs = totalSec % 60

    const text =
      days > 0
        ? `in ${days}d ${hours}h`
        : hours > 0
          ? `in ${hours}h ${mins}m ${secs}s`
          : mins > 0
            ? `in ${mins}m ${secs}s`
            : `in ${secs}s`
    return { text, tone: 'text-muted' }
  }

  // From air time through the broadcast window, then "Aired".
  if (ms > -BROADCAST_WINDOW_MS)
    return {
      text: 'Airing now',
      tone: 'rounded-full bg-accent/15 px-2 py-0.5 text-accent-strong',
    }
  return { text: 'Aired', tone: 'text-subtle' }
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
  key: string // localDateKey
  isoDay: DayOfWeek // viewer-local weekday (0=Mon … 6=Sun)
  monthDay: string // "Jun 17"
  weekdayShort: string // "Wed"
  isToday: boolean
}

/** A page of `count` consecutive viewer-local days from `baseMs` + `offsetDays`. */
function buildDays(baseMs: number, offsetDays: number, count: number): DayInfo[] {
  const base = new Date(baseMs)
  const out: DayInfo[] = []
  for (let i = 0; i < count; i++) {
    const d = new Date(
      base.getFullYear(),
      base.getMonth(),
      base.getDate() + offsetDays + i,
    )
    out.push({
      key: localDateKey(d),
      isoDay: (((d.getDay() + 6) % 7) as DayOfWeek),
      monthDay: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      weekdayShort: d.toLocaleDateString('en-US', { weekday: 'short' }),
      isToday: offsetDays + i === 0,
    })
  }
  return out
}

type Occurrence = { entry: ScheduleEntry; instant: Date }

/**
 * Resolve each weekly slot to its concrete occurrence within the visible window
 * and bucket it by the viewer-local calendar day of that instant. We scan one
 * extra day on each side of the window because a slot's occurrence can land on a
 * viewer-local date offset from its JST broadcast date.
 */
function bucketByLocalDay(
  entries: ScheduleEntry[],
  baseMs: number,
  offsetDays: number,
  count: number,
): Map<string, Occurrence[]> {
  const base = new Date(baseMs)
  const buckets = new Map<string, Occurrence[]>()
  for (let i = 0; i < count; i++) {
    const d = new Date(
      base.getFullYear(),
      base.getMonth(),
      base.getDate() + offsetDays + i,
    )
    buckets.set(localDateKey(d), [])
  }

  for (const e of entries) {
    for (let i = -1; i <= count; i++) {
      const cand = new Date(
        base.getFullYear(),
        base.getMonth(),
        base.getDate() + offsetDays + i,
      )
      // A calendar date's weekday is timezone-independent, so cand's weekday is
      // the JST broadcast weekday when we read its Y/M/D as a JST date.
      if (((cand.getDay() + 6) % 7) !== e.dayOfWeek) continue
      const instant = airInstant(
        cand.getFullYear(),
        cand.getMonth() + 1,
        cand.getDate(),
        e.airTime,
        e.timezone,
      )
      const bucket = buckets.get(localDateKey(instant))
      if (bucket) bucket.push({ entry: e, instant })
    }
  }

  for (const list of buckets.values()) {
    list.sort((a, b) => a.instant.getTime() - b.instant.getTime())
  }
  return buckets
}

export function ScheduleGrid({ entries }: { entries: ScheduleEntry[] }) {
  const mounted = useMounted()
  const [weekOffset, setWeekOffset] = useState(0) // 0 … MAX_WEEKS_AHEAD
  const [selected, setSelected] = useState(0) // index within the visible week

  // Live clock (drives the countdowns; suppressHydrationWarning covers SSR).
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  // Local midnight of "today" — stable within a day, so the bucket memo below
  // recomputes on page change or at midnight, not on every 1-second tick.
  const baseMs = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime()

  const buckets = useMemo(
    () => bucketByLocalDay(entries, baseMs, weekOffset * VISIBLE_DAYS, VISIBLE_DAYS),
    [entries, baseMs, weekOffset],
  )

  if (!mounted) return <ScheduleSkeleton />

  const days = buildDays(baseMs, weekOffset * VISIBLE_DAYS, VISIBLE_DAYS)
  const selectedDay = days[Math.min(selected, days.length - 1)] ?? days[0]
  const dayOccurrences = buckets.get(selectedDay.key) ?? []
  const onToday = weekOffset === 0 && selected === 0

  const pageDays = (delta: number) => {
    setWeekOffset((o) => Math.min(MAX_WEEKS_AHEAD, Math.max(0, o + delta)))
    setSelected(0)
  }
  const goToday = () => {
    setWeekOffset(0)
    setSelected(0)
  }

  return (
    <div
      data-testid="schedule-grid"
      className="overflow-hidden rounded-card border border-border bg-card/30"
    >
      {/* Header: "Today" jump (left) + live clock (right) */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-border px-4 py-3">
        {/* Always-present "Today" jump, highlighted when the selected day is
            not today. */}
        <button
          type="button"
          data-testid="schedule-today"
          data-active={!onToday}
          onClick={goToday}
          aria-label={onToday ? undefined : 'Return to today'}
          className={cn(
            'rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
            onToday
              ? 'border-border text-muted hover:bg-card-hover hover:text-foreground'
              : 'border-accent bg-accent/15 text-accent-strong hover:bg-accent/25',
          )}
        >
          Today
        </button>
        <span
          className="text-xs tabular-nums text-muted"
          suppressHydrationWarning
        >
          Now: {now.toLocaleDateString('en-US')}{' '}
          {now.toLocaleTimeString('en-US')}
        </span>
      </div>

      {/* Day picker: ‹ days › (a button group, not an ARIA tablist) */}
      <div className="flex items-stretch gap-1 border-b border-border p-2">
        <ArrowButton
          dir="left"
          disabled={weekOffset === 0}
          onClick={() => pageDays(-1)}
        />
        <div
          role="group"
          aria-label="Pick a day"
          className="no-scrollbar flex flex-1 gap-1 overflow-x-auto"
        >
          {days.map((d, i) => {
            const isSelected = i === selected
            return (
              <button
                key={d.key}
                type="button"
                aria-pressed={isSelected}
                aria-current={d.isToday ? 'date' : undefined}
                aria-label={`${d.weekdayShort} ${d.monthDay}${d.isToday ? ' (today)' : ''}`}
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
      <DayList
        key={`${weekOffset}-${selectedDay.key}`}
        occurrences={dayOccurrences}
        day={selectedDay}
        now={now}
      />

      {/* Timezone note, beneath the schedule. */}
      <div className="border-t border-border px-4 py-3">
        <span className="text-xs text-subtle">
          Times shown in your local timezone (source: JST).
        </span>
      </div>
    </div>
  )
}

function DayList({
  occurrences,
  day,
  now,
}: {
  occurrences: Occurrence[]
  day: DayInfo
  now: Date
}) {
  const [expanded, setExpanded] = useState(false)

  if (occurrences.length === 0) {
    return (
      <p
        data-testid="schedule-empty"
        role="region"
        aria-label={`Releases for ${day.monthDay}`}
        className="px-4 py-12 text-center text-sm text-subtle"
      >
        Nothing scheduled for this day{' '}
        <span aria-hidden="true">(－.－)zZz</span>
      </p>
    )
  }

  const shown = expanded ? occurrences : occurrences.slice(0, LIST_LIMIT)

  return (
    <div role="region" aria-label={`Releases for ${day.monthDay}`}>
      <ul className="divide-y divide-border/50">
        {shown.map((occ) => (
          <ScheduleRow
            key={`${occ.entry.show.id}-${occ.instant.getTime()}`}
            occurrence={occ}
            now={now}
          />
        ))}
      </ul>
      {occurrences.length > LIST_LIMIT && (
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

function ScheduleRow({ occurrence, now }: { occurrence: Occurrence; now: Date }) {
  const { entry, instant } = occurrence
  const { show } = entry
  const localTime = useMemo(() => formatLocalTime(instant), [instant])
  // Estimated next episode = released count + 1 (this is an estimated schedule).
  const episode = Math.max(show.subEpisodes, show.dubEpisodes) + 1
  const cd = countdown(instant, now)

  return (
    <li
      data-testid="schedule-entry"
      className="group flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-card-hover sm:px-4"
    >
      <time
        dateTime={instant.toISOString()}
        className="w-14 shrink-0 text-right text-xs font-bold tabular-nums text-muted"
      >
        {localTime}
      </time>

      {/* Select the SHOW: poster + title + audio badges. The poster is
          decorative (alt="") because the title names the link. */}
      <Link
        href={`/shows/${show.slug}`}
        data-testid="schedule-show-link"
        className="flex min-w-0 flex-1 items-center gap-3 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <div
          data-testid="schedule-poster"
          className="relative h-14 w-10 shrink-0 overflow-hidden rounded-md bg-surface ring-1 ring-border"
        >
          <Image
            src={show.coverImage}
            alt=""
            fill
            sizes="40px"
            className="object-cover"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-foreground transition-colors group-hover:text-accent-strong">
            {show.title}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-subtle">
            <span className="font-medium">TV</span>
            <SubDubBadges
              subEpisodes={show.subEpisodes}
              dubEpisodes={show.dubEpisodes}
              size="sm"
            />
          </div>
        </div>
      </Link>

      {/* Select the EPISODE: deep-links to /shows/{slug}?ep=N + countdown. */}
      <div className="flex shrink-0 flex-col items-end gap-1">
        <Link
          href={`/shows/${show.slug}?ep=${episode}`}
          data-testid="schedule-episode"
          aria-label={`Watch ${show.title} episode ${episode}`}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-bold tabular-nums text-accent-strong transition-colors hover:border-accent/50 hover:bg-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Play className="size-3 fill-current" aria-hidden />
          EP {episode}
        </Link>
        <span
          data-testid="schedule-countdown"
          className={cn(
            // Reserve a stable, right-aligned box so the live seconds tick in
            // place instead of shifting the chip's left edge each second.
            'min-w-[5.5rem] text-right text-xs font-semibold tabular-nums',
            cd.tone,
          )}
        >
          {cd.text}
        </span>
      </div>
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
          <div key={i} className="h-14 animate-pulse rounded bg-card-hover" />
        ))}
      </div>
    </div>
  )
}

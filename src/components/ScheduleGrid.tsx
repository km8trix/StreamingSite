'use client'

import Link from 'next/link'
import Image from 'next/image'
import type { ScheduleEntry, DayOfWeek } from '@/lib/data'
import { cn } from '@/lib/utils'

/**
 * ScheduleGrid — client component because it does viewer-local TZ conversion
 * and "today" detection (both are client-specific, unavailable on the server).
 *
 * DayOfWeek convention (from data layer): 0=Monday … 6=Sunday (ISO week).
 * JS Date.getDay() uses 0=Sunday … 6=Saturday, so we map:
 *   isoDay = (jsDay + 6) % 7   (Sun→6, Mon→0, …, Sat→5) ✓
 */

const ALL_DAYS: DayOfWeek[] = [0, 1, 2, 3, 4, 5, 6]

// A column in the rolling schedule: an actual upcoming calendar date plus the
// ISO weekday it falls on (used to map entries, which are keyed by dayOfWeek).
type RollingDay = {
  isoDay: DayOfWeek // 0=Mon … 6=Sun — used for data-day + entry grouping
  isToday: boolean
  monthDay: string // "Jun 17"
  weekdayShort: string // "Wed"
  weekdayLong: string // "Wednesday"
}

/**
 * Build a rolling window of `count` days starting today (viewer-local), each
 * carrying its real date labels. 7 consecutive days cover every ISO weekday
 * exactly once, so the schedule shows real dates ("Jun 17 · Wed") rolling
 * forward from today instead of a fixed Monday→Sunday week.
 */
function buildRollingDays(count = 7): RollingDay[] {
  const now = new Date()
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const out: RollingDay[] = []
  for (let i = 0; i < count; i++) {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i)
    const isoDay = (((d.getDay() + 6) % 7) as DayOfWeek) // Sun→6, Mon→0, …
    out.push({
      isoDay,
      isToday: i === 0,
      monthDay: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      weekdayShort: d.toLocaleDateString('en-US', { weekday: 'short' }),
      weekdayLong: d.toLocaleDateString('en-US', { weekday: 'long' }),
    })
  }
  return out
}

/** Convert a JST 'HH:MM' string + IANA timezone to viewer-local HH:MM display. */
function jstToLocalTime(airTime: string, sourceTimezone: string): string {
  const [hStr, mStr] = airTime.split(':')
  const hours = parseInt(hStr, 10)
  const minutes = parseInt(mStr, 10)

  // Build a reference date (today) so DST offsets are current.
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const day = now.getDate()

  // Format YYYY-MM-DDTHH:MM:00 in the source timezone using Intl to obtain
  // the UTC equivalent, then re-format in the viewer's local timezone.
  //
  // Strategy: use a known UTC time and offset it. We construct a Date whose
  // wall-clock in `sourceTimezone` matches the supplied airTime on today's
  // date. We do this by parsing the ISO string in that TZ via DateTimeFormat
  // trickery: format "today" in the source TZ to get its UTC offset, then
  // apply.
  const srcFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: sourceTimezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  // Find the UTC offset for today in the source timezone by constructing a
  // Date at midnight UTC and seeing what the source timezone says the hour is.
  const utcMidnight = Date.UTC(year, month - 1, day, hours, minutes, 0)
  const testDate = new Date(utcMidnight)

  // Parse what the source timezone sees this UTC moment as.
  const parts = srcFormatter.formatToParts(testDate)
  const srcHour = parseInt(parts.find((p) => p.type === 'hour')!.value, 10)
  const srcMin = parseInt(parts.find((p) => p.type === 'minute')!.value, 10)

  // Compute the delta between what we want (hours:minutes) and what UTC maps to.
  const wantMinutes = hours * 60 + minutes
  const gotMinutes = srcHour * 60 + srcMin
  const deltaMs = (wantMinutes - gotMinutes) * 60 * 1000

  // Adjust testDate so it shows the correct airTime in sourceTimezone.
  const airDate = new Date(testDate.getTime() + deltaMs)

  // Now format in the viewer's local timezone (default, no timeZone specified).
  const localFormatter = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
  return localFormatter.format(airDate)
}

export function ScheduleGrid({ entries }: { entries: ScheduleEntry[] }) {
  const rollingDays = buildRollingDays()

  // Group entries by dayOfWeek
  const byDay = new Map<DayOfWeek, ScheduleEntry[]>()
  for (const day of ALL_DAYS) byDay.set(day, [])
  for (const entry of entries) {
    byDay.get(entry.dayOfWeek)!.push(entry)
  }

  // Sort each day's entries by local air time
  for (const [day, dayEntries] of byDay.entries()) {
    byDay.set(
      day,
      // Sort by source air time (HH:MM, 24h) — already chronological. JST has no
      // DST so source order equals viewer-local order; comparing the 12h display
      // strings (e.g. "11:00 PM" vs "1:00 AM") would order them wrong.
      dayEntries.sort((a, b) => a.airTime.localeCompare(b.airTime)),
    )
  }

  return (
    <div data-testid="schedule-grid">
      {/* Timezone note */}
      <p className="mb-4 text-xs text-subtle">
        Times shown in your local timezone. Source times are JST (Asia/Tokyo).
      </p>

      {/* Desktop: 7-column grid, rolling from today */}
      <div className="hidden lg:grid lg:grid-cols-7 lg:gap-3">
        {rollingDays.map((rd) => (
          <DayColumn
            key={rd.isoDay}
            rollingDay={rd}
            entries={byDay.get(rd.isoDay)!}
            convertTime={jstToLocalTime}
          />
        ))}
      </div>

      {/* Mobile/tablet: stacked list */}
      <div className="flex flex-col gap-4 lg:hidden">
        {rollingDays.map((rd) => (
          <DayColumn
            key={rd.isoDay}
            rollingDay={rd}
            entries={byDay.get(rd.isoDay)!}
            convertTime={jstToLocalTime}
            stacked
          />
        ))}
      </div>
    </div>
  )
}

function DayColumn({
  rollingDay,
  entries,
  convertTime,
  stacked = false,
}: {
  rollingDay: RollingDay
  entries: ScheduleEntry[]
  convertTime: (airTime: string, tz: string) => string
  stacked?: boolean
}) {
  const { isoDay, isToday, monthDay, weekdayShort, weekdayLong } = rollingDay
  return (
    <div
      data-testid="schedule-day"
      data-day={isoDay}
      className={cn(
        'flex flex-col rounded-card border transition-colors',
        isToday
          ? 'border-accent/60 bg-accent/5'
          : 'border-border bg-card/30',
      )}
    >
      {/* Day header — abbreviated month + day on top, weekday below (rolling). */}
      <div
        className={cn(
          'flex items-center justify-between gap-2 rounded-t-card px-3 py-2.5',
          isToday ? 'bg-accent/15' : 'bg-surface/60',
        )}
      >
        <span className="flex flex-col leading-tight">
          <span
            className={cn(
              'text-[0.625rem] font-semibold uppercase tracking-wider tabular-nums',
              isToday ? 'text-accent-strong/80' : 'text-subtle',
            )}
          >
            {monthDay}
          </span>
          <span
            className={cn(
              'text-xs font-bold uppercase tracking-widest',
              isToday ? 'text-accent-strong' : 'text-muted',
            )}
          >
            {stacked ? weekdayLong : weekdayShort}
          </span>
        </span>
        {isToday && (
          <span className="inline-flex items-center gap-1 rounded-full bg-accent/20 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider text-accent-strong">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex size-1.5 rounded-full bg-accent" />
            </span>
            Today
          </span>
        )}
      </div>

      {/* Entries */}
      <div className="flex flex-col gap-2 p-2">
        {entries.length === 0 ? (
          <div className="flex flex-1 items-center justify-center py-6 text-center">
            <span className="text-xs text-subtle">No releases</span>
          </div>
        ) : (
          entries.map((entry) => (
            <ScheduleCard
              key={`${entry.show.id}-${entry.dayOfWeek}`}
              entry={entry}
              localTime={convertTime(entry.airTime, entry.timezone)}
            />
          ))
        )}
      </div>
    </div>
  )
}

function ScheduleCard({
  entry,
  localTime,
}: {
  entry: ScheduleEntry
  localTime: string
}) {
  const { show } = entry
  return (
    <Link
      href={`/shows/${show.slug}`}
      data-testid="schedule-entry"
      className={cn(
        'group flex items-center gap-2.5 rounded-md border border-border/60 bg-card p-2 transition-all duration-150',
        'hover:-translate-y-0.5 hover:border-accent/50 hover:bg-card-hover hover:shadow-[0_4px_16px_-6px_rgba(139,92,246,0.35)]',
        'focus-visible:-translate-y-0.5 focus-visible:border-accent',
      )}
    >
      {/* Cover thumbnail */}
      <div className="relative size-10 shrink-0 overflow-hidden rounded-md bg-surface">
        <Image
          src={show.coverImage}
          alt={`${show.title} cover`}
          fill
          sizes="40px"
          className="object-cover transition-transform duration-200 group-hover:scale-105"
        />
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold leading-tight text-foreground group-hover:text-accent-strong">
          {show.title}
        </p>
        <p className="mt-0.5 text-[0.65rem] tabular-nums text-subtle">
          {localTime}
        </p>
      </div>
    </Link>
  )
}

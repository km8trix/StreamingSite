// relativeTime — format an ISO timestamp as a short relative string
// ("just now", "5m ago", "3h ago", "2d ago", …) for comment metadata.
//
// Deterministic given a `now` reference (defaults to Date.now()), so it is safe
// to unit-test. Falls back to an absolute date for anything older than ~30 days.

const MINUTE = 60
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const WEEK = 7 * DAY
const MONTH = 30 * DAY

export function formatRelativeTime(
  iso: string,
  now: number = Date.now(),
): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''

  const seconds = Math.round((now - then) / 1000)

  // Clock skew / future timestamps: treat as "just now" rather than "-3s ago".
  if (seconds < 30) return 'just now'
  if (seconds < MINUTE) return `${seconds}s ago`
  if (seconds < HOUR) return `${Math.floor(seconds / MINUTE)}m ago`
  if (seconds < DAY) return `${Math.floor(seconds / HOUR)}h ago`
  if (seconds < WEEK) return `${Math.floor(seconds / DAY)}d ago`
  if (seconds < MONTH) return `${Math.floor(seconds / WEEK)}w ago`

  // Older than a month: show an absolute calendar date (locale-independent,
  // TZ-safe by reading the UTC-parsed Date's parts).
  const d = new Date(then)
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

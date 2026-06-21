import type { Metadata } from 'next'
import { getWeeklySchedule } from '@/lib/data'
import { ScheduleGrid } from '@/components/ScheduleGrid'

export const metadata: Metadata = {
  title: 'Release Schedule',
  description:
    'Weekly air schedule for currently-airing anime. Times shown in your local timezone.',
  alternates: { canonical: '/schedule' },
}

// The schedule reflects the current week / live data; don't statically cache it.
export const dynamic = 'force-dynamic'

export default async function SchedulePage() {
  const entries = await getWeeklySchedule()

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
          Release Schedule
        </h1>
        <span className="text-sm text-muted">
          {entries.length === 0
            ? 'No airing shows this week'
            : `${entries.length} slot${entries.length === 1 ? '' : 's'} this week`}
        </span>
      </div>

      <ScheduleGrid entries={entries} />
    </div>
  )
}

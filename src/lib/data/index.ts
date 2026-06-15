// Public entry point for the data layer.
// UI imports from '@/lib/data' — never from Supabase directly.

export type {
  AudioFilter,
  DayOfWeek,
  Episode,
  Genre,
  ScheduleEntry,
  ShowDetail,
  ShowFilter,
  ShowFilterResult,
  ShowSort,
  ShowStatus,
  ShowSummary,
} from './types'

export {
  getAllShows,
  getPopularShows,
  getRandomShow,
  getRecentlyUpdatedShows,
  getRecommendedShows,
  getShowBySlug,
  listGenres,
} from './shows'

export { getWeeklySchedule } from './schedule'

export { listFilterYears, searchAndFilterShows } from './search'

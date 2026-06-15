// Public entry point for the data layer.
// UI imports from '@/lib/data' — never from Supabase directly.

export type {
  AudioFilter,
  CurrentUser,
  DayOfWeek,
  Episode,
  Genre,
  Profile,
  ScheduleEntry,
  ShowDetail,
  ShowFilter,
  ShowFilterResult,
  ShowSort,
  ShowStatus,
  ShowSummary,
  UserRole,
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

export { getCurrentUser, getProfile, getProfileByUsername } from './profiles'

// Public entry point for the data layer.
// UI imports from '@/lib/data' — never from Supabase directly.

export type {
  Episode,
  Genre,
  ShowDetail,
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

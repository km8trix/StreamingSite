// Public entry point for the data layer.
// UI imports from '@/lib/data' — never from Supabase directly.

export type {
  AdPlacement,
  AudioFilter,
  Comment,
  CommentAuthor,
  CommentThread,
  CurrentUser,
  DayOfWeek,
  Episode,
  ForumAuthor,
  ForumCategory,
  ForumPost,
  ForumThread,
  ForumThreadWithPosts,
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

export {
  addComment,
  deleteComment,
  editComment,
  getComments,
} from './comments'

export {
  createThread,
  deletePost,
  editPost,
  getCategory,
  getThread,
  listCategories,
  listThreads,
  lockThread,
  pinThread,
  replyToThread,
} from './forum'

export type { CreateThreadResult, ForumActionResult } from './forum'

export { getAdForPlacement, recordAdClick, recordAdImpression } from './ads'

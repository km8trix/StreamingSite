// Public entry point for the data layer.
// UI imports from '@/lib/data' — never from Supabase directly.

export type {
  AdPlacement,
  AudioFilter,
  Comment,
  CommentAuthor,
  CommentThread,
  ContinueWatchingItem,
  CurrentUser,
  DayOfWeek,
  Episode,
  ForumAuthor,
  ForumCategory,
  ForumPost,
  ForumThread,
  ForumThreadWithPosts,
  Genre,
  NewsArticle,
  Profile,
  ScheduleEntry,
  SearchSuggestion,
  ShowDetail,
  ShowFilter,
  ShowFilterResult,
  ShowSort,
  ShowStatus,
  ShowSummary,
  StreamingLink,
  TopAnimeWindow,
  UserRole,
} from './types'

export {
  getAllShows,
  getGenreBySlug,
  getPopularShows,
  getRandomShow,
  getRecentlyUpdatedShows,
  getRecommendedForYou,
  getRecommendedShows,
  getShowBySlug,
  getTopAnime,
  listGenres,
} from './shows'

export { getWeeklySchedule } from './schedule'

export { getNews } from './news'

export { getWhereToWatch } from './where-to-watch'

export {
  getSearchSuggestions,
  listFilterYears,
  searchAndFilterShows,
} from './search'

export { getCurrentUser, getProfile, getProfileByUsername } from './profiles'

export { getContinueWatching } from './watch-progress'

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

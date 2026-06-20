import type { RateLimitRule } from './rate-limit'

// Per-IP rate-limit policy for the mutation surfaces (auth + comment + forum).
// Centralized here so limits are easy to review/tune in one place. Keyed BY IP
// (loopback/unknown is exempt → local dev + e2e bypass). All windows in ms.
//
// Rationale for the split:
//   - auth is PRE-auth: blunt credential stuffing (signin) + account farming
//     (signup) from a single source; OAuth start/callback get looser caps since
//     a normal user triggers them a few times.
//   - content writes are POST-auth: blunt comment/forum spam. Creation is capped
//     tighter than edits/deletes (which are lower-risk and naturally repeated).
// Forum pin/lock are intentionally NOT limited here — they are moderator-gated.
export const RATE_LIMITS = {
  // --- auth ---
  signIn: { name: 'auth-signin', limit: 10, windowMs: 5 * 60_000 },
  signUp: { name: 'auth-signup', limit: 8, windowMs: 15 * 60_000 },
  oauthStart: { name: 'auth-oauth', limit: 15, windowMs: 5 * 60_000 },
  oauthCallback: { name: 'auth-callback', limit: 30, windowMs: 5 * 60_000 },
  profileUpdate: { name: 'auth-profile', limit: 20, windowMs: 5 * 60_000 },

  // --- comments ---
  commentCreate: { name: 'comment-create', limit: 10, windowMs: 60_000 },
  commentMutate: { name: 'comment-mutate', limit: 30, windowMs: 60_000 },

  // --- forum ---
  threadCreate: { name: 'forum-thread', limit: 5, windowMs: 5 * 60_000 },
  postReply: { name: 'forum-reply', limit: 10, windowMs: 60_000 },
  postMutate: { name: 'forum-post-mutate', limit: 30, windowMs: 60_000 },
} as const satisfies Record<string, RateLimitRule>

'use server'

// Auth server actions (Milestone 3, Feature 1: AUTH).
//
// These run on the server only and use the COOKIE-BASED getServerClient() so
// Supabase Auth can read/write the session cookie. The service-role key is
// never touched here — signup/signin/signout all go through the anon client +
// the user's own credentials.
//
// Contract:
//   - on FAILURE: return a typed `{ error: string }` (the UI renders it inline);
//   - on SUCCESS: revalidate the relevant paths and redirect.
//
// NOTE on redirect(): Next implements redirect() by throwing a special control-
// flow error. It must therefore be called OUTSIDE any try/catch that would
// swallow it — every action below calls redirect() after the try block.

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getServerClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/database.types'
import { getCurrentUser } from '@/lib/data/profiles'
import { getSiteOrigin } from '@/lib/site-url'
import { safeRedirectPath } from './safe-redirect'

type ProfileUpdate = Database['public']['Tables']['profiles']['Update']

export type AuthResult = { error?: string }

const MIN_PASSWORD_LENGTH = 6

// ---------------------------------------------------------------------------
// Input coercion — accept either explicit args or a FormData payload so the
// actions can be used both programmatically and as <form action={...}>.
// ---------------------------------------------------------------------------

type SignUpInput = {
  email: string
  password: string
  username?: string
}

type SignInInput = {
  email: string
  password: string
}

function readString(value: FormDataEntryValue | null | undefined): string {
  return typeof value === 'string' ? value.trim() : ''
}

function coerceSignUp(input: FormData | SignUpInput): SignUpInput {
  if (input instanceof FormData) {
    return {
      email: readString(input.get('email')),
      password: typeof input.get('password') === 'string'
        ? (input.get('password') as string)
        : '',
      username: readString(input.get('username')) || undefined,
    }
  }
  return {
    email: input.email.trim(),
    password: input.password,
    username: input.username?.trim() || undefined,
  }
}

function coerceSignIn(input: FormData | SignInInput): SignInInput {
  if (input instanceof FormData) {
    return {
      email: readString(input.get('email')),
      password: typeof input.get('password') === 'string'
        ? (input.get('password') as string)
        : '',
    }
  }
  return { email: input.email.trim(), password: input.password }
}

// Optional post-auth redirect target carried by a hidden `next` form field, so
// "sign in to continue" flows return the user where they started. Only present
// on FormData submissions; programmatic calls default to '/'. Always passed
// through safeRedirectPath() so it can't become an off-site open redirect.
function readNext(input: FormData | unknown): string {
  return input instanceof FormData
    ? safeRedirectPath(readString(input.get('next')))
    : '/'
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/**
 * Create an account with email + password. `username` (when provided) is passed
 * in options.data so the handle_new_user() trigger uses it for the profile;
 * otherwise the trigger falls back to the email local-part. With
 * `enable_confirmations = false` (local dev) the user is signed in immediately.
 *
 * Returns `{ error }` on validation/auth failure; otherwise redirects to `/`.
 */
export async function signUp(input: FormData | SignUpInput): Promise<AuthResult> {
  const { email, password, username } = coerceSignUp(input)

  if (!email) return { error: 'Email is required.' }
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` }
  }

  const supabase = await getServerClient()
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Consumed by handle_new_user() (new.raw_user_meta_data->>'username').
      data: username ? { username, display_name: username } : {},
    },
  })

  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  redirect(readNext(input))
}

/**
 * Sign in with email + password. Returns `{ error }` on failure; otherwise
 * redirects to `/`.
 */
export async function signIn(input: FormData | SignInInput): Promise<AuthResult> {
  const { email, password } = coerceSignIn(input)

  if (!email) return { error: 'Email is required.' }
  if (!password) return { error: 'Password is required.' }

  const supabase = await getServerClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  redirect(readNext(input))
}

/**
 * Begin "Sign in with Google" (OAuth Authorization Code + PKCE).
 *
 * signInWithOAuth() does NOT sign the user in here — on the server it generates
 * the PKCE code verifier (stored in a cookie via the @supabase/ssr adapter) and
 * returns the Google consent URL. We then redirect() the browser to Google;
 * after consent Google redirects to `<origin>/auth/callback?code=…`, where the
 * route handler exchanges the code for a session.
 *
 * Works the same for first-time and returning users (OAuth has no separate
 * "sign up" step). Because Google asserts a verified email, these users get a
 * session immediately even though email/password signup keeps confirmations on.
 *
 * `next` (optional, from a hidden form field) is the same-origin path to land on
 * afterwards; it is open-redirect-sanitized here AND again in the callback.
 *
 * Returns `{ error }` only if Supabase can't start the flow; on success it
 * redirect()s (which throws Next's control-flow signal and never returns).
 */
export async function signInWithGoogle(
  input?: FormData,
): Promise<AuthResult> {
  const next =
    input instanceof FormData
      ? safeRedirectPath(readString(input.get('next')))
      : '/'

  const origin = await getSiteOrigin()
  const callbackUrl = new URL('/auth/callback', origin)
  if (next && next !== '/') callbackUrl.searchParams.set('next', next)

  const supabase = await getServerClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: callbackUrl.toString() },
  })

  if (error) return { error: error.message }
  if (!data?.url) {
    return { error: 'Could not start Google sign-in. Please try again.' }
  }

  // External redirect to Google's consent screen (throws — never returns).
  redirect(data.url)
}

/**
 * Sign out the current session and return to the home page.
 *
 * `auth.signOut()` revokes the session and clears the BASE `sb-<ref>-auth-token`
 * cookie, but when the JWT is large enough that @supabase/ssr CHUNKS it into
 * `sb-<ref>-auth-token.0` / `.1`, those numbered chunks are NOT removed — and
 * middleware's `updateSession() -> getUser()` re-validates the surviving chunks
 * on the redirect, leaving the user effectively signed-in. To make sign-out
 * DETERMINISTIC we explicitly delete every cookie whose name belongs to a
 * Supabase auth-token (base + every numbered chunk). This runs in a Server
 * Action, where cookie writes are permitted.
 */
export async function signOut(): Promise<AuthResult> {
  const supabase = await getServerClient()
  const { error } = await supabase.auth.signOut()

  if (error) return { error: error.message }

  // Belt-and-braces: enumerate cookies and drop every Supabase auth-token
  // variant (base `sb-<ref>-auth-token` and chunked `…auth-token.0/.1/…`) so no
  // surviving chunk can be re-validated by middleware on the next request.
  const cookieStore = await cookies()
  for (const { name } of cookieStore.getAll()) {
    if (/^sb-.*-auth-token(\.\d+)?$/.test(name)) {
      cookieStore.delete(name)
    }
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

// ---------------------------------------------------------------------------
// Profile mutation (auth-gated; updates ONLY the caller's own row via RLS)
// ---------------------------------------------------------------------------

type UpdateProfileInput = {
  displayName?: string | null
  avatarUrl?: string | null
  username?: string | null
}

function coerceUpdateProfile(
  input: FormData | UpdateProfileInput,
): UpdateProfileInput {
  if (input instanceof FormData) {
    const out: UpdateProfileInput = {}
    if (input.has('displayName')) out.displayName = readString(input.get('displayName')) || null
    if (input.has('avatarUrl')) out.avatarUrl = readString(input.get('avatarUrl')) || null
    if (input.has('username')) out.username = readString(input.get('username')) || null
    return out
  }
  return input
}

/**
 * Update the signed-in user's own profile (display name, avatar URL, optional
 * username). The RLS "Users update own profile" policy guarantees a user can
 * only touch their own row even though we also scope the query by id.
 *
 * Returns `{ error }` when signed out, on a username collision, or on any DB
 * error; otherwise revalidates the profile pages and returns `{}` (no redirect,
 * so the caller can re-render in place).
 */
export async function updateProfile(
  input: FormData | UpdateProfileInput,
): Promise<AuthResult> {
  const current = await getCurrentUser()
  if (!current) return { error: 'You must be signed in to update your profile.' }

  const fields = coerceUpdateProfile(input)

  // Build a sparse update from only the provided keys.
  const update: ProfileUpdate = {}
  if ('displayName' in fields) update.display_name = fields.displayName ?? null
  if ('avatarUrl' in fields) {
    // avatar_url is rendered as a plain <img src> to other users, so reject
    // non-http(s) schemes (data:/javascript:/relative) and cap the length —
    // an unvalidated value is a tracking-pixel / SSRF-via-browser vector.
    const avatar = fields.avatarUrl?.trim() ?? ''
    if (avatar && (!/^https?:\/\//i.test(avatar) || avatar.length > 2048)) {
      return {
        error: 'Avatar URL must be an http(s) link under 2048 characters.',
      }
    }
    update.avatar_url = avatar || null
  }
  if ('username' in fields) {
    const username = fields.username?.trim() ?? ''
    if (username && !/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
      return {
        error: 'Username must be 3–30 characters: letters, numbers, or underscores.',
      }
    }
    update.username = username || null
  }

  if (Object.keys(update).length === 0) return {}

  const supabase = await getServerClient()
  const { error } = await supabase
    .from('profiles')
    .update(update)
    .eq('id', current.userId)

  if (error) {
    // 23505 = unique_violation (username already taken).
    if ((error as { code?: string }).code === '23505') {
      return { error: 'That username is already taken.' }
    }
    return { error: error.message }
  }

  revalidatePath('/profile')
  if (current.profile?.username) {
    revalidatePath(`/u/${current.profile.username}`)
  }
  return {}
}

// Profile data-access layer (Milestone 3, Feature 1: AUTH).
//
// Unlike the catalog helpers (shows/schedule/search) these are SESSION-aware:
// getCurrentUser() must read the auth cookie, so it uses the COOKIE-BASED
// getServerClient() (never getPublicClient — that one is cookie-free and would
// always look signed-out).
//
// Raw Supabase rows never leak out of this file: mapProfileRow centralizes the
// row -> domain (Profile) mapping.

import { getServerClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import type { CurrentUser, Profile, UserRole } from './types'

// ---------------------------------------------------------------------------
// Row -> domain mapping
// ---------------------------------------------------------------------------

type ProfileRow = {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
  role: string
  created_at: string
  updated_at: string
}

function coerceRole(value: string): UserRole {
  return value === 'moderator' || value === 'admin' ? value : 'user'
}

function mapProfileRow(row: ProfileRow): Profile {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    role: coerceRole(row.role),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

const PROFILE_COLUMNS =
  'id, username, display_name, avatar_url, role, created_at, updated_at'

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * The signed-in user + their public profile, or `null` when there is no session.
 *
 * Returns `null` when:
 *   - Supabase isn't configured, OR
 *   - there is no valid auth session (signed out).
 *
 * Returns a `CurrentUser` when signed in. `profile` is the mapped profiles row,
 * or `null` in the (rare) window before the new-user trigger has materialized
 * the row — callers should treat a present user with `profile === null` as
 * "signed in, profile pending".
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (!isSupabaseConfigured()) return null

  // Build/render resilience: a live failure here MUST NOT throw. getCurrentUser
  // runs in the header on every page (incl. statically generated ones), and the
  // cloud DB/auth server may be empty / unmigrated / unreachable. Returning null
  // = "logged out", which is always safe. (The profiles read already degrades to
  // profile=null; this outer guard also covers auth.getUser() / client creation.)
  try {
    const supabase = await getServerClient()

    // getUser() validates the JWT with the auth server (more trustworthy than
    // getSession(), which only decodes the cookie).
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) return null

    const { data, error } = await supabase
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('id', user.id)
      .maybeSingle()

    // A missing profile row is not fatal (trigger may not have run yet); only a
    // real query error is unexpected. We swallow it to null rather than throw so
    // a transient profiles read never takes down the whole layout/header.
    const profile = !error && data ? mapProfileRow(data as ProfileRow) : null

    return {
      userId: user.id,
      email: user.email ?? null,
      profile,
    }
  } catch (err) {
    console.warn('[data] getCurrentUser live query failed, falling back:', err)
    return null
  }
}

/** A single public profile by auth user id, or `null` if not found. */
export async function getProfile(userId: string): Promise<Profile | null> {
  if (!isSupabaseConfigured()) return null

  try {
    const supabase = await getServerClient()
    const { data, error } = await supabase
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('id', userId)
      .maybeSingle()

    if (error) throw error
    if (!data) return null
    return mapProfileRow(data as ProfileRow)
  } catch (err) {
    console.warn('[data] getProfile live query failed, falling back:', err)
    return null
  }
}

/** A single public profile by username (case-insensitive), or `null`. */
export async function getProfileByUsername(
  username: string,
): Promise<Profile | null> {
  if (!isSupabaseConfigured()) return null

  try {
    const supabase = await getServerClient()
    const { data, error } = await supabase
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .ilike('username', username)
      .maybeSingle()

    if (error) throw error
    if (!data) return null
    return mapProfileRow(data as ProfileRow)
  } catch (err) {
    console.warn(
      '[data] getProfileByUsername live query failed, falling back:',
      err,
    )
    return null
  }
}

import { beforeEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// M3 Feature 1 (AUTH) — profiles data-helper unit tests.
//
// These exercise src/lib/data/profiles.ts with the Supabase server client and
// the `isSupabaseConfigured()` gate MOCKED, so we never touch a live database
// or the real `@supabase/ssr` cookie machinery. We assert:
//   - getCurrentUser() returns null when Supabase isn't configured / signed out,
//   - getCurrentUser() validates the JWT via auth.getUser() (not getSession),
//   - row -> domain mapping (snake_case -> camelCase, role coercion),
//   - raw DB rows never leak (no snake_case keys on the returned domain object),
//   - getProfile / getProfileByUsername null + error behavior.
// ---------------------------------------------------------------------------

// Mock the config module so isSupabaseConfigured() is controllable per-test.
// (config.ts reads process.env at import time into top-level consts, so setting
// process.env in a test would NOT flip the already-evaluated value — mocking the
// module is the reliable way to toggle the configured/unconfigured branch.)
const isConfiguredMock = vi.fn(() => true)
vi.mock('@/lib/supabase/config', () => ({
  get SUPABASE_URL() {
    return 'http://127.0.0.1:54321'
  },
  get SUPABASE_ANON_KEY() {
    return 'anon-key-for-tests'
  },
  isSupabaseConfigured: () => isConfiguredMock(),
}))

// Mock the server Supabase client. getServerClient() returns whatever the
// current test installs via setClient(). This stands in for the real
// @supabase/ssr cookie-bound client.
let installedClient: unknown = null
function setClient(client: unknown) {
  installedClient = client
}
const getServerClientMock = vi.fn(async () => installedClient)
vi.mock('@/lib/supabase/server', () => ({
  getServerClient: () => getServerClientMock(),
}))

import {
  getCurrentUser,
  getProfile,
  getProfileByUsername,
} from '@/lib/data/profiles'

// A representative raw profiles row (snake_case, as PostgREST returns it).
function rawProfileRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    username: 'alice',
    display_name: 'Alice',
    avatar_url: 'https://cdn.example.com/a.png',
    role: 'user',
    created_at: '2026-06-01T00:00:00.000Z',
    updated_at: '2026-06-02T00:00:00.000Z',
    ...overrides,
  }
}

// Build a fake Supabase client whose .from('profiles').select().eq()/.ilike()
// .maybeSingle() resolves to { data, error }. Also records auth.getUser /
// auth.getSession calls so we can assert which one the helper used.
function makeFakeClient(opts: {
  user?: { id: string; email?: string | null } | null
  userError?: unknown
  rows?: { data: unknown; error: unknown }
}) {
  const calls = {
    getUser: 0,
    getSession: 0,
    selected: [] as string[],
    eq: [] as Array<[string, unknown]>,
    ilike: [] as Array<[string, unknown]>,
  }

  const builder = {
    select(cols: string) {
      calls.selected.push(cols)
      return builder
    },
    eq(col: string, val: unknown) {
      calls.eq.push([col, val])
      return builder
    },
    ilike(col: string, val: unknown) {
      calls.ilike.push([col, val])
      return builder
    },
    async maybeSingle() {
      return opts.rows ?? { data: null, error: null }
    },
  }

  const client = {
    auth: {
      async getUser() {
        calls.getUser += 1
        return {
          data: { user: opts.user ?? null },
          error: opts.userError ?? null,
        }
      },
      async getSession() {
        calls.getSession += 1
        return { data: { session: null }, error: null }
      },
    },
    from(table: string) {
      expect(table).toBe('profiles')
      return builder
    },
  }

  return { client, calls }
}

beforeEach(() => {
  isConfiguredMock.mockReturnValue(true)
  installedClient = null
  getServerClientMock.mockClear()
})

// ---------------------------------------------------------------------------
// getCurrentUser
// ---------------------------------------------------------------------------

describe('getCurrentUser', () => {
  it('returns null when Supabase is not configured (never builds a client)', async () => {
    isConfiguredMock.mockReturnValue(false)
    expect(await getCurrentUser()).toBeNull()
    expect(getServerClientMock).not.toHaveBeenCalled()
  })

  it('returns null when there is no session (auth.getUser -> no user)', async () => {
    const { client } = makeFakeClient({ user: null })
    setClient(client)
    expect(await getCurrentUser()).toBeNull()
  })

  it('returns null when auth.getUser reports an error', async () => {
    const { client } = makeFakeClient({
      user: { id: 'x' },
      userError: { message: 'jwt expired' },
    })
    setClient(client)
    expect(await getCurrentUser()).toBeNull()
  })

  it('validates the JWT via auth.getUser() (not the weaker getSession())', async () => {
    const { client, calls } = makeFakeClient({
      user: { id: rawProfileRow().id, email: 'alice@example.com' },
      rows: { data: rawProfileRow(), error: null },
    })
    setClient(client)
    await getCurrentUser()
    expect(calls.getUser).toBe(1)
    expect(calls.getSession).toBe(0)
  })

  it('returns the signed-in user + mapped profile (camelCase domain shape)', async () => {
    const { client } = makeFakeClient({
      user: { id: rawProfileRow().id, email: 'alice@example.com' },
      rows: { data: rawProfileRow(), error: null },
    })
    setClient(client)

    const current = await getCurrentUser()
    expect(current).toEqual({
      userId: '11111111-1111-1111-1111-111111111111',
      email: 'alice@example.com',
      profile: {
        id: '11111111-1111-1111-1111-111111111111',
        username: 'alice',
        displayName: 'Alice',
        avatarUrl: 'https://cdn.example.com/a.png',
        role: 'user',
        createdAt: '2026-06-01T00:00:00.000Z',
        updatedAt: '2026-06-02T00:00:00.000Z',
      },
    })
  })

  it('never leaks raw snake_case row keys onto the domain profile', async () => {
    const { client } = makeFakeClient({
      user: { id: rawProfileRow().id, email: 'alice@example.com' },
      rows: { data: rawProfileRow(), error: null },
    })
    setClient(client)

    const current = await getCurrentUser()
    const profile = current!.profile!
    expect(profile).not.toHaveProperty('display_name')
    expect(profile).not.toHaveProperty('avatar_url')
    expect(profile).not.toHaveProperty('created_at')
    expect(profile).not.toHaveProperty('updated_at')
  })

  it('coerces an unknown role to "user" (defensive against bad data)', async () => {
    const { client } = makeFakeClient({
      user: { id: rawProfileRow().id, email: null },
      rows: { data: rawProfileRow({ role: 'superuser' }), error: null },
    })
    setClient(client)
    const current = await getCurrentUser()
    expect(current!.profile!.role).toBe('user')
  })

  it.each(['moderator', 'admin'] as const)(
    'preserves the privileged role "%s" from the row',
    async (role) => {
      const { client } = makeFakeClient({
        user: { id: rawProfileRow().id, email: null },
        rows: { data: rawProfileRow({ role }), error: null },
      })
      setClient(client)
      const current = await getCurrentUser()
      expect(current!.profile!.role).toBe(role)
    },
  )

  it('returns user with profile=null when the profile row has not materialized', async () => {
    const { client } = makeFakeClient({
      user: { id: 'no-profile-yet', email: 'pending@example.com' },
      rows: { data: null, error: null },
    })
    setClient(client)
    const current = await getCurrentUser()
    expect(current).toEqual({
      userId: 'no-profile-yet',
      email: 'pending@example.com',
      profile: null,
    })
  })

  it('swallows a profiles read error to profile=null (never throws from the header path)', async () => {
    const { client } = makeFakeClient({
      user: { id: 'u', email: 'u@example.com' },
      rows: { data: null, error: { message: 'permission denied' } },
    })
    setClient(client)
    const current = await getCurrentUser()
    expect(current).toEqual({ userId: 'u', email: 'u@example.com', profile: null })
  })

  it('normalizes a missing email to null', async () => {
    const { client } = makeFakeClient({
      user: { id: 'u' }, // no email key at all
      rows: { data: null, error: null },
    })
    setClient(client)
    const current = await getCurrentUser()
    expect(current!.email).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// getProfile / getProfileByUsername
// ---------------------------------------------------------------------------

describe('getProfile', () => {
  it('returns null when Supabase is not configured', async () => {
    isConfiguredMock.mockReturnValue(false)
    expect(await getProfile('any-id')).toBeNull()
    expect(getServerClientMock).not.toHaveBeenCalled()
  })

  it('maps a found row to the Profile domain shape and queries by id', async () => {
    const { client, calls } = makeFakeClient({
      rows: { data: rawProfileRow(), error: null },
    })
    setClient(client)
    const profile = await getProfile('11111111-1111-1111-1111-111111111111')
    expect(profile).toMatchObject({ username: 'alice', displayName: 'Alice' })
    expect(calls.eq).toContainEqual(['id', '11111111-1111-1111-1111-111111111111'])
    expect(profile).not.toHaveProperty('display_name')
  })

  it('returns null when no row is found', async () => {
    const { client } = makeFakeClient({ rows: { data: null, error: null } })
    setClient(client)
    expect(await getProfile('missing')).toBeNull()
  })

  it('throws when the query errors (unexpected DB failure surfaces)', async () => {
    const { client } = makeFakeClient({
      rows: { data: null, error: { message: 'boom' } },
    })
    setClient(client)
    await expect(getProfile('x')).rejects.toMatchObject({ message: 'boom' })
  })
})

describe('getProfileByUsername', () => {
  it('returns null when Supabase is not configured', async () => {
    isConfiguredMock.mockReturnValue(false)
    expect(await getProfileByUsername('alice')).toBeNull()
  })

  it('queries case-insensitively via ilike and maps the row', async () => {
    const { client, calls } = makeFakeClient({
      rows: { data: rawProfileRow(), error: null },
    })
    setClient(client)
    const profile = await getProfileByUsername('ALICE')
    expect(profile).toMatchObject({ username: 'alice' })
    expect(calls.ilike).toContainEqual(['username', 'ALICE'])
  })

  it('returns null when no row is found', async () => {
    const { client } = makeFakeClient({ rows: { data: null, error: null } })
    setClient(client)
    expect(await getProfileByUsername('nobody')).toBeNull()
  })

  it('throws when the query errors', async () => {
    const { client } = makeFakeClient({
      rows: { data: null, error: { message: 'kaboom' } },
    })
    setClient(client)
    await expect(getProfileByUsername('x')).rejects.toMatchObject({
      message: 'kaboom',
    })
  })
})

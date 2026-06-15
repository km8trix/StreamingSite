import { beforeEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// M3 Feature 1 (AUTH) — auth server-action unit tests.
//
// We mock everything the actions reach for so no live Supabase / cookies /
// Next runtime is needed:
//   - next/cache       -> revalidatePath spy
//   - next/navigation  -> redirect spy that THROWS (mimicking Next's real
//                         control-flow behavior: redirect() never returns)
//   - @/lib/supabase/server -> getServerClient returns a fake auth client
//   - @/lib/data/profiles   -> getCurrentUser (used by updateProfile)
//
// Asserted behavior:
//   - validation: missing email/password rejected BEFORE any Supabase call,
//   - signOut / updateProfile require a session,
//   - Supabase error.message is mapped onto { error } (and 23505 -> "taken"),
//   - on success the action revalidates + redirects (signUp/signIn/signOut),
//   - secrets (passwords, service-role key, tokens) are never returned to the
//     caller — only { error?: string }.
// ---------------------------------------------------------------------------

const revalidatePath = vi.fn()
vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => revalidatePath(...args),
}))

// Fake cookie store for next/headers. signOut() enumerates getAll() and
// delete()s every Supabase auth-token cookie (base + chunks) so sign-out is
// deterministic even when @supabase/ssr chunks the session into `.0`/`.1`.
let cookieJar: Array<{ name: string; value: string }> = []
const cookieDeletes: string[] = []
const cookieStore = {
  getAll() {
    return cookieJar
  },
  delete(name: string) {
    cookieDeletes.push(name)
    cookieJar = cookieJar.filter((c) => c.name !== name)
  },
}
vi.mock('next/headers', () => ({
  cookies: async () => cookieStore,
}))

// redirect() in Next throws a special control-flow error and never returns; the
// production action code relies on that (it calls redirect() outside try/catch).
// Our mock throws a tagged error so tests can detect "reached the redirect".
class RedirectError extends Error {
  constructor(public to: string) {
    super(`NEXT_REDIRECT:${to}`)
    this.name = 'RedirectError'
  }
}
const redirect = vi.fn((to: string) => {
  throw new RedirectError(to)
})
vi.mock('next/navigation', () => ({
  redirect: (to: string) => redirect(to),
}))

// Fake Supabase auth client. Each test installs the responses it wants.
type AuthResponses = {
  signUp?: { error: { message: string } | null }
  signInWithPassword?: { error: { message: string } | null }
  signOut?: { error: { message: string } | null }
  update?: { error: { message: string; code?: string } | null }
}
let responses: AuthResponses = {}
const authCalls = {
  signUp: [] as unknown[],
  signInWithPassword: [] as unknown[],
  signOut: 0,
  updates: [] as unknown[],
  updateEq: [] as Array<[string, unknown]>,
}

function makeFakeClient() {
  const updateBuilder = {
    update(payload: unknown) {
      authCalls.updates.push(payload)
      return updateBuilder
    },
    async eq(col: string, val: unknown) {
      authCalls.updateEq.push([col, val])
      return responses.update ?? { error: null }
    },
  }
  return {
    auth: {
      async signUp(payload: unknown) {
        authCalls.signUp.push(payload)
        return responses.signUp ?? { error: null }
      },
      async signInWithPassword(payload: unknown) {
        authCalls.signInWithPassword.push(payload)
        return responses.signInWithPassword ?? { error: null }
      },
      async signOut() {
        authCalls.signOut += 1
        return responses.signOut ?? { error: null }
      },
    },
    from(table: string) {
      expect(table).toBe('profiles')
      return updateBuilder
    },
  }
}

const getServerClientMock = vi.fn(async () => makeFakeClient())
vi.mock('@/lib/supabase/server', () => ({
  getServerClient: () => getServerClientMock(),
}))

// updateProfile() calls getCurrentUser() to enforce auth + get the user id.
const getCurrentUserMock = vi.fn()
vi.mock('@/lib/data/profiles', () => ({
  getCurrentUser: () => getCurrentUserMock(),
}))

import { signIn, signOut, signUp, updateProfile } from '@/lib/auth/actions'

// Helper: invoke an action and capture either its returned value OR the redirect
// target if it redirected (threw RedirectError). Re-throws anything else.
async function runAction<T>(
  fn: () => Promise<T>,
): Promise<{ result?: T; redirectedTo?: string }> {
  try {
    const result = await fn()
    return { result }
  } catch (err) {
    if (err instanceof RedirectError) return { redirectedTo: err.to }
    throw err
  }
}

beforeEach(() => {
  responses = {}
  authCalls.signUp = []
  authCalls.signInWithPassword = []
  authCalls.signOut = 0
  authCalls.updates = []
  authCalls.updateEq = []
  revalidatePath.mockClear()
  redirect.mockClear()
  getServerClientMock.mockClear()
  getCurrentUserMock.mockReset()
  // Seed the cookie jar with a realistic chunked Supabase session plus an
  // unrelated cookie that sign-out must NOT touch.
  cookieJar = [
    { name: 'sb-127-auth-token.0', value: 'chunk0' },
    { name: 'sb-127-auth-token.1', value: 'chunk1' },
    { name: 'sb-127-auth-token', value: 'base' },
    { name: 'theme', value: 'dark' },
  ]
  cookieDeletes.length = 0
})

// ---------------------------------------------------------------------------
// signUp
// ---------------------------------------------------------------------------

describe('signUp', () => {
  it('rejects a missing email before calling Supabase', async () => {
    const { result } = await runAction(() =>
      signUp({ email: '', password: 'secret123' }),
    )
    expect(result).toEqual({ error: 'Email is required.' })
    expect(getServerClientMock).not.toHaveBeenCalled()
  })

  it('rejects a whitespace-only email (trimmed to empty)', async () => {
    const { result } = await runAction(() =>
      signUp({ email: '   ', password: 'secret123' }),
    )
    expect(result).toEqual({ error: 'Email is required.' })
    expect(getServerClientMock).not.toHaveBeenCalled()
  })

  it('rejects a missing password before calling Supabase', async () => {
    const { result } = await runAction(() =>
      signUp({ email: 'a@b.com', password: '' }),
    )
    expect(result).toEqual({
      error: 'Password must be at least 6 characters.',
    })
    expect(getServerClientMock).not.toHaveBeenCalled()
  })

  it('rejects a too-short password (< 6 chars)', async () => {
    const { result } = await runAction(() =>
      signUp({ email: 'a@b.com', password: '12345' }),
    )
    expect(result).toEqual({
      error: 'Password must be at least 6 characters.',
    })
    expect(getServerClientMock).not.toHaveBeenCalled()
  })

  it('maps a Supabase signUp error onto { error } (no redirect)', async () => {
    responses.signUp = { error: { message: 'User already registered' } }
    const { result, redirectedTo } = await runAction(() =>
      signUp({ email: 'taken@b.com', password: 'secret123' }),
    )
    expect(result).toEqual({ error: 'User already registered' })
    expect(redirectedTo).toBeUndefined()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('on success revalidates the layout and redirects to /', async () => {
    const { redirectedTo } = await runAction(() =>
      signUp({ email: 'new@b.com', password: 'secret123', username: 'newbie' }),
    )
    expect(redirectedTo).toBe('/')
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout')
  })

  it('passes username through options.data for the new-user trigger', async () => {
    await runAction(() =>
      signUp({ email: 'new@b.com', password: 'secret123', username: 'newbie' }),
    )
    expect(authCalls.signUp[0]).toMatchObject({
      email: 'new@b.com',
      password: 'secret123',
      options: { data: { username: 'newbie', display_name: 'newbie' } },
    })
  })

  it('omits username metadata when none is supplied', async () => {
    await runAction(() => signUp({ email: 'new@b.com', password: 'secret123' }))
    expect(authCalls.signUp[0]).toMatchObject({
      email: 'new@b.com',
      options: { data: {} },
    })
  })

  it('accepts a FormData payload (used as a <form action>)', async () => {
    const fd = new FormData()
    fd.set('email', '  fd@b.com  ')
    fd.set('password', 'secret123')
    fd.set('username', 'fduser')
    const { redirectedTo } = await runAction(() => signUp(fd))
    expect(redirectedTo).toBe('/')
    expect(authCalls.signUp[0]).toMatchObject({
      email: 'fd@b.com', // trimmed
      password: 'secret123',
      options: { data: { username: 'fduser', display_name: 'fduser' } },
    })
  })

  it('does not leak the password back to the caller on any outcome', async () => {
    responses.signUp = { error: { message: 'nope' } }
    const { result } = await runAction(() =>
      signUp({ email: 'a@b.com', password: 'sup3rsecret' }),
    )
    expect(JSON.stringify(result)).not.toContain('sup3rsecret')
    expect(Object.keys(result ?? {})).toEqual(['error'])
  })
})

// ---------------------------------------------------------------------------
// signIn
// ---------------------------------------------------------------------------

describe('signIn', () => {
  it('rejects a missing email before calling Supabase', async () => {
    const { result } = await runAction(() =>
      signIn({ email: '', password: 'secret123' }),
    )
    expect(result).toEqual({ error: 'Email is required.' })
    expect(getServerClientMock).not.toHaveBeenCalled()
  })

  it('rejects a missing password before calling Supabase', async () => {
    const { result } = await runAction(() =>
      signIn({ email: 'a@b.com', password: '' }),
    )
    expect(result).toEqual({ error: 'Password is required.' })
    expect(getServerClientMock).not.toHaveBeenCalled()
  })

  it('maps invalid-credentials error onto { error } (no redirect)', async () => {
    responses.signInWithPassword = {
      error: { message: 'Invalid login credentials' },
    }
    const { result, redirectedTo } = await runAction(() =>
      signIn({ email: 'a@b.com', password: 'wrongpass' }),
    )
    expect(result).toEqual({ error: 'Invalid login credentials' })
    expect(redirectedTo).toBeUndefined()
  })

  it('on success revalidates the layout and redirects to /', async () => {
    const { redirectedTo } = await runAction(() =>
      signIn({ email: 'a@b.com', password: 'secret123' }),
    )
    expect(redirectedTo).toBe('/')
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout')
    expect(authCalls.signInWithPassword[0]).toMatchObject({
      email: 'a@b.com',
      password: 'secret123',
    })
  })

  it('does not leak the password back to the caller on failure', async () => {
    responses.signInWithPassword = { error: { message: 'Invalid login credentials' } }
    const { result } = await runAction(() =>
      signIn({ email: 'a@b.com', password: 'myp@ssw0rd' }),
    )
    expect(JSON.stringify(result)).not.toContain('myp@ssw0rd')
  })
})

// ---------------------------------------------------------------------------
// signOut
// ---------------------------------------------------------------------------

describe('signOut', () => {
  it('on success revalidates the layout and redirects to /', async () => {
    const { redirectedTo } = await runAction(() => signOut())
    expect(redirectedTo).toBe('/')
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout')
    expect(authCalls.signOut).toBe(1)
  })

  it('clears ALL Supabase auth-token cookie variants (base + chunks), leaving others', async () => {
    // Secure behavior: auth.signOut() only reliably drops the base cookie, so the
    // action ALSO deletes every `sb-*-auth-token` / `…auth-token.<n>` cookie. This
    // is the fix for the chunked-cookie sign-out bug — without it the surviving
    // `.0`/`.1` chunks keep the user signed-in via middleware re-validation.
    await runAction(() => signOut())
    expect(cookieDeletes).toEqual(
      expect.arrayContaining([
        'sb-127-auth-token',
        'sb-127-auth-token.0',
        'sb-127-auth-token.1',
      ]),
    )
    // Non-auth cookies are untouched.
    expect(cookieDeletes).not.toContain('theme')
  })

  it('maps a Supabase signOut error onto { error } (no redirect)', async () => {
    responses.signOut = { error: { message: 'session not found' } }
    const { result, redirectedTo } = await runAction(() => signOut())
    expect(result).toEqual({ error: 'session not found' })
    expect(redirectedTo).toBeUndefined()
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// updateProfile
// ---------------------------------------------------------------------------

describe('updateProfile', () => {
  const signedIn = {
    userId: 'user-123',
    email: 'a@b.com',
    profile: {
      id: 'user-123',
      username: 'alice',
      displayName: 'Alice',
      avatarUrl: null,
      role: 'user' as const,
      createdAt: '2026-06-01T00:00:00.000Z',
      updatedAt: '2026-06-01T00:00:00.000Z',
    },
  }

  it('requires a session — returns an error and never queries when signed out', async () => {
    getCurrentUserMock.mockResolvedValue(null)
    const result = await updateProfile({ displayName: 'New Name' })
    expect(result).toEqual({
      error: 'You must be signed in to update your profile.',
    })
    expect(getServerClientMock).not.toHaveBeenCalled()
  })

  it('updates the display name scoped to the caller’s own id', async () => {
    getCurrentUserMock.mockResolvedValue(signedIn)
    const result = await updateProfile({ displayName: 'New Name' })
    expect(result).toEqual({})
    expect(authCalls.updates[0]).toEqual({ display_name: 'New Name' })
    expect(authCalls.updateEq).toContainEqual(['id', 'user-123'])
    expect(revalidatePath).toHaveBeenCalledWith('/profile')
  })

  it('rejects an invalid username format before touching the DB', async () => {
    getCurrentUserMock.mockResolvedValue(signedIn)
    const result = await updateProfile({ username: 'no' }) // too short
    expect(result).toEqual({
      error:
        'Username must be 3–30 characters: letters, numbers, or underscores.',
    })
    expect(getServerClientMock).not.toHaveBeenCalled()
  })

  it('rejects a username with illegal characters', async () => {
    getCurrentUserMock.mockResolvedValue(signedIn)
    const result = await updateProfile({ username: 'has spaces!' })
    expect(result).toMatchObject({ error: expect.stringContaining('Username must be') })
    expect(getServerClientMock).not.toHaveBeenCalled()
  })

  it('maps a unique-violation (23505) to "username already taken"', async () => {
    getCurrentUserMock.mockResolvedValue(signedIn)
    responses.update = {
      error: { message: 'duplicate key value', code: '23505' },
    }
    const result = await updateProfile({ username: 'taken_name' })
    expect(result).toEqual({ error: 'That username is already taken.' })
  })

  it('surfaces a non-23505 DB error message verbatim', async () => {
    getCurrentUserMock.mockResolvedValue(signedIn)
    responses.update = { error: { message: 'permission denied', code: '42501' } }
    const result = await updateProfile({ displayName: 'x' })
    expect(result).toEqual({ error: 'permission denied' })
  })

  it('no-ops (returns {}) when no updatable fields are provided', async () => {
    getCurrentUserMock.mockResolvedValue(signedIn)
    const result = await updateProfile({})
    expect(result).toEqual({})
    // No DB round-trip for an empty update.
    expect(getServerClientMock).not.toHaveBeenCalled()
  })

  it('never returns role in the update payload (no self-role escalation via the action)', async () => {
    getCurrentUserMock.mockResolvedValue(signedIn)
    // Even if a caller smuggles a role-ish field, updateProfile ignores it: the
    // action only maps displayName / avatarUrl / username.
    await updateProfile({
      displayName: 'x',
      // @ts-expect-error — role is intentionally not part of the input type.
      role: 'admin',
    })
    expect(authCalls.updates[0]).toEqual({ display_name: 'x' })
    expect(authCalls.updates[0]).not.toHaveProperty('role')
  })

  it('reads displayName/avatarUrl/username from a FormData payload', async () => {
    getCurrentUserMock.mockResolvedValue(signedIn)
    const fd = new FormData()
    fd.set('displayName', '  Spaced Name  ')
    fd.set('avatarUrl', 'https://cdn.example.com/x.png')
    const result = await updateProfile(fd)
    expect(result).toEqual({})
    expect(authCalls.updates[0]).toEqual({
      display_name: 'Spaced Name', // trimmed
      avatar_url: 'https://cdn.example.com/x.png',
    })
  })

  it('does not leak secrets — only { error?: string } is ever returned', async () => {
    getCurrentUserMock.mockResolvedValue(signedIn)
    responses.update = { error: { message: 'boom' } }
    const result = await updateProfile({ displayName: 'x' })
    expect(Object.keys(result)).toEqual(['error'])
    expect(JSON.stringify(result)).not.toContain('user-123') // no user id leaked
  })
})

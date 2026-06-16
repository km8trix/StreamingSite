import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test, request as pwRequest } from '@playwright/test'

// M3 Feature 3 — FORUM adversarial security e2e (LIVE local Supabase).
//
// Verifies the contract's critical guarantees at the PostgREST layer with REAL
// tokens — not by trusting the server action / RLS from reading the code. We hit
// the DB directly with each user's JWT and prove the database REJECTS abuse and
// ALLOWS the legit/moderator cases:
//
//   (a) user A cannot create a thread/post AS user B (spoofed user_id REJECTED);
//   (b) a NON-moderator cannot pin/lock a thread or delete another user's post
//       (REJECTED — RLS filters the row → 0 rows, target unchanged);
//   (c) promote a user to role=moderator via the SERVICE-ROLE path, then confirm
//       the moderator CAN pin/lock a thread and delete any post (ALLOWED);
//   (d) a non-mod cannot reply to a LOCKED thread via raw PostgREST (REJECTED);
//   (e) a soft-deleted post cannot be un-deleted/repopulated (one-way ratchet).
//
// NOTE on (c): `role` is intentionally NOT in any PostgREST column grant (0003
// hardening — stops self-escalation via REST), so even the service_role REST
// client cannot PATCH it. The realistic admin path is a privileged SQL UPDATE as
// the postgres superuser (bypasses RLS + column grants) — run via the local
// Supabase Postgres container, mirroring scripts/forum_live_check.mjs.
//
// Rows persist; `npx supabase db reset` wipes accounts + forum content.

// Load the live Supabase keys. Playwright runs in plain Node, which does NOT
// auto-load .env.local (only Next does), so we parse it ourselves — preferring an
// already-set process.env, then `.env.local`. Zero new deps.
function loadEnvLocal(): Record<string, string> {
  try {
    const raw = readFileSync(resolve(__dirname, '..', '.env.local'), 'utf8')
    const out: Record<string, string> = {}
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
    return out
  } catch {
    return {}
  }
}
const env = loadEnvLocal()
const ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const API_URL = (
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  env.NEXT_PUBLIC_SUPABASE_URL ??
  'http://127.0.0.1:54321'
).replace(/\/$/, '')

const CATEGORY_ID = 'cat-general' // seeded
const DB_CONTAINER = 'supabase_db_StreamingSite'

type User = { token: string; userId: string }

// Sign up a brand-new user via GoTrue and return their JWT + user id. With
// enable_confirmations=false the signup response carries an access_token + user.
async function signUpUser(
  api: import('@playwright/test').APIRequestContext,
  label: string,
): Promise<User> {
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}-${label}`
  const res = await api.post(`${API_URL}/auth/v1/signup`, {
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    data: { email: `fadv.${label}+${stamp}@example.com`, password: 'secret123' },
  })
  expect(res.ok(), `signup for ${label} should succeed`).toBeTruthy()
  const body = await res.json()
  const token = body.access_token as string
  const userId = (body.user?.id ?? body.id) as string
  expect(token, 'signup returns an access_token (confirmations disabled)').toBeTruthy()
  expect(userId, 'signup returns the new user id').toBeTruthy()
  return { token, userId }
}

// Helpers that hit PostgREST directly with a user's JWT.
function authHeaders(token: string) {
  return {
    apikey: ANON_KEY,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  }
}

test.describe('Forum — adversarial RLS (cannot act as another / escalate)', () => {
  // These hit the DB directly and create persistent rows; serialize for a
  // readable shared setup and to avoid signup rate noise.
  test.describe.configure({ mode: 'serial' })

  test.skip(!ANON_KEY, 'requires live Supabase env (NEXT_PUBLIC_SUPABASE_ANON_KEY)')

  let api: import('@playwright/test').APIRequestContext
  let userA: User // thread + post owner
  let userB: User // attacker / later promoted to moderator
  let threadId: string
  let firstPostId: string

  test.beforeAll(async () => {
    api = await pwRequest.newContext()
    userA = await signUpUser(api, 'A')
    userB = await signUpUser(api, 'B')

    // A creates a legit thread (own user_id) — the target for the attacks.
    const tRes = await api.post(`${API_URL}/rest/v1/forum_threads`, {
      headers: authHeaders(userA.token),
      data: {
        category_id: CATEGORY_ID,
        user_id: userA.userId,
        title: 'A adversarial thread',
        slug: `a-adv-${Date.now()}`,
      },
      failOnStatusCode: false,
    })
    expect(tRes.status(), 'A can create their own thread').toBe(201)
    threadId = (await tRes.json())[0].id
    expect(threadId).toBeTruthy()

    // A creates the first post (own user_id).
    const pRes = await api.post(`${API_URL}/rest/v1/forum_posts`, {
      headers: authHeaders(userA.token),
      data: { thread_id: threadId, user_id: userA.userId, body: 'First post by A' },
      failOnStatusCode: false,
    })
    expect(pRes.status(), 'A can create their own first post').toBe(201)
    firstPostId = (await pRes.json())[0].id
    expect(firstPostId).toBeTruthy()
  })

  test.afterAll(async () => {
    // Clean up the thread (cascades to posts) + the test users via service role.
    if (SERVICE_KEY && threadId) {
      await api.delete(`${API_URL}/rest/v1/forum_threads?id=eq.${threadId}`, {
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
        failOnStatusCode: false,
      })
      for (const id of [userA?.userId, userB?.userId].filter(Boolean)) {
        await api.delete(`${API_URL}/auth/v1/admin/users/${id}`, {
          headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
          failOnStatusCode: false,
        })
      }
    }
    await api.dispose()
  })

  // -------------------------------------------------------------------------
  // (a) cannot create a thread/post AS another user (spoofed user_id)
  // -------------------------------------------------------------------------
  test('(a1) a user CANNOT create a thread spoofing another user_id', async () => {
    // B authenticates as B but sends user_id = A → RLS WITH CHECK (user_id =
    // auth.uid()) must reject. Posting AS someone else is forbidden.
    const res = await api.post(`${API_URL}/rest/v1/forum_threads`, {
      headers: authHeaders(userB.token),
      data: {
        category_id: CATEGORY_ID,
        user_id: userA.userId, // spoofed
        title: 'B pretending to be A',
        slug: `spoof-${Date.now()}`,
      },
      failOnStatusCode: false,
    })
    expect(res.status(), 'spoofed-author thread insert is rejected').toBe(403)
    const err = await res.json()
    expect(err.code, 'RLS policy violation code').toBe('42501')
    expect(err.message).toMatch(/row-level security/i)
  })

  test('(a2) a user CANNOT create a post spoofing another user_id', async () => {
    const res = await api.post(`${API_URL}/rest/v1/forum_posts`, {
      headers: authHeaders(userB.token),
      data: { thread_id: threadId, user_id: userA.userId, body: 'spoofed post' },
      failOnStatusCode: false,
    })
    expect(res.status(), 'spoofed-author post insert is rejected').toBe(403)
    const err = await res.json()
    expect(err.code).toBe('42501')
    expect(err.message).toMatch(/row-level security/i)
  })

  test('(a3) an anonymous (no-JWT) client CANNOT create a thread', async () => {
    const res = await api.post(`${API_URL}/rest/v1/forum_threads`, {
      headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
      data: {
        category_id: CATEGORY_ID,
        user_id: userA.userId,
        title: 'anon spoof',
        slug: `anon-${Date.now()}`,
      },
      failOnStatusCode: false,
    })
    expect(res.ok()).toBeFalsy()
    expect(res.status()).toBeGreaterThanOrEqual(400)
  })

  // -------------------------------------------------------------------------
  // (b) a NON-moderator cannot pin/lock a thread or delete another's post
  // -------------------------------------------------------------------------
  test("(b1) a non-mod CANNOT pin another user's thread (0 rows, stays unpinned)", async () => {
    const res = await api.patch(`${API_URL}/rest/v1/forum_threads?id=eq.${threadId}`, {
      headers: authHeaders(userB.token),
      data: { is_pinned: true },
      failOnStatusCode: false,
    })
    // RLS WITH CHECK pins is_pinned to its stored value for non-mods → 0 rows.
    expect(await res.json()).toEqual([])
    const check = await api.get(
      `${API_URL}/rest/v1/forum_threads?id=eq.${threadId}&select=is_pinned`,
      { headers: { apikey: ANON_KEY } },
    )
    expect((await check.json())[0].is_pinned).toBe(false)
  })

  test("(b2) a non-mod CANNOT lock another user's thread (stays unlocked)", async () => {
    const res = await api.patch(`${API_URL}/rest/v1/forum_threads?id=eq.${threadId}`, {
      headers: authHeaders(userB.token),
      data: { is_locked: true },
      failOnStatusCode: false,
    })
    expect(await res.json()).toEqual([])
    const check = await api.get(
      `${API_URL}/rest/v1/forum_threads?id=eq.${threadId}&select=is_locked`,
      { headers: { apikey: ANON_KEY } },
    )
    expect((await check.json())[0].is_locked).toBe(false)
  })

  test("(b3) a NON-MOD AUTHOR cannot pin/lock their OWN thread (flags are mod-only)", async () => {
    // A owns the thread but is not a moderator; RLS WITH CHECK still pins the
    // moderation flags to their stored values for non-mods.
    const res = await api.patch(`${API_URL}/rest/v1/forum_threads?id=eq.${threadId}`, {
      headers: authHeaders(userA.token),
      data: { is_pinned: true, is_locked: true },
      failOnStatusCode: false,
    })
    // The author OWNS the row (RLS USING passes), so the WITH CHECK that pins the
    // moderation flags for non-mods fails HARD: a 403 / 42501 RLS violation. (For
    // a NON-owner — b1/b2 — RLS USING filters the row out first → 0 rows instead.)
    // Accept either; the invariant is the flags never flip.
    if (res.status() === 200) {
      expect(await res.json()).toEqual([])
    } else {
      expect(res.status()).toBe(403)
      const err = await res.json()
      expect(err.code).toBe('42501')
      expect(err.message).toMatch(/row-level security/i)
    }
    const check = await api.get(
      `${API_URL}/rest/v1/forum_threads?id=eq.${threadId}&select=is_pinned,is_locked`,
      { headers: { apikey: ANON_KEY } },
    )
    const [row] = await check.json()
    expect(row.is_pinned).toBe(false)
    expect(row.is_locked).toBe(false)
  })

  test('(b3b) a NON-MOD AUTHOR can still rename their own thread (title writable)', async () => {
    const res = await api.patch(`${API_URL}/rest/v1/forum_threads?id=eq.${threadId}`, {
      headers: authHeaders(userA.token),
      data: { title: 'A renamed thread' },
      failOnStatusCode: false,
    })
    expect(res.status()).toBe(200)
    expect((await res.json())[0].title).toBe('A renamed thread')
  })

  test("(b4) a non-mod CANNOT soft-delete another user's post (intact)", async () => {
    const res = await api.patch(`${API_URL}/rest/v1/forum_posts?id=eq.${firstPostId}`, {
      headers: authHeaders(userB.token),
      data: { is_deleted: true, body: '' },
      failOnStatusCode: false,
    })
    expect(await res.json()).toEqual([])
    const check = await api.get(
      `${API_URL}/rest/v1/forum_posts?id=eq.${firstPostId}&select=is_deleted,body`,
      { headers: { apikey: ANON_KEY } },
    )
    const [row] = await check.json()
    expect(row.is_deleted).toBe(false)
    expect(row.body).toBe('First post by A')
  })

  test("(b5) a non-mod CANNOT hard-delete another user's post (row survives)", async () => {
    const res = await api.delete(`${API_URL}/rest/v1/forum_posts?id=eq.${firstPostId}`, {
      headers: authHeaders(userB.token),
      failOnStatusCode: false,
    })
    expect(await res.json()).toEqual([])
    const check = await api.get(
      `${API_URL}/rest/v1/forum_posts?id=eq.${firstPostId}&select=id`,
      { headers: { apikey: ANON_KEY } },
    )
    expect(await check.json()).toEqual([{ id: firstPostId }])
  })

  test("(b6) a user CANNOT re-own another's post via user_id PATCH", async () => {
    // Targeting the ownership column: not in B's update set (RLS) AND user_id is
    // not in the column-restricted UPDATE grant. Either rejected or 0-rows; A
    // still owns the post.
    const res = await api.patch(`${API_URL}/rest/v1/forum_posts?id=eq.${firstPostId}`, {
      headers: authHeaders(userB.token),
      data: { user_id: userB.userId },
      failOnStatusCode: false,
    })
    if (res.status() === 200) {
      expect(await res.json()).toEqual([])
    } else {
      expect(res.status()).toBeGreaterThanOrEqual(400)
    }
    const check = await api.get(
      `${API_URL}/rest/v1/forum_posts?id=eq.${firstPostId}&select=user_id`,
      { headers: { apikey: ANON_KEY } },
    )
    expect((await check.json())[0].user_id).toBe(userA.userId)
  })

  // -------------------------------------------------------------------------
  // (e) one-way soft-delete ratchet (own row) — placed BEFORE the moderator
  //     block so it operates on a post that is still A's own live post.
  // -------------------------------------------------------------------------
  test('(e) a soft-deleted post CANNOT be un-deleted or repopulated (own row)', async () => {
    // A creates a throwaway post, soft-deletes it, then tries to revive it.
    const created = await api.post(`${API_URL}/rest/v1/forum_posts`, {
      headers: authHeaders(userA.token),
      data: { thread_id: threadId, user_id: userA.userId, body: 'will be deleted' },
      failOnStatusCode: false,
    })
    expect(created.status()).toBe(201)
    const id = (await created.json())[0].id as string

    // Owner soft-deletes (allowed).
    const del = await api.patch(`${API_URL}/rest/v1/forum_posts?id=eq.${id}`, {
      headers: authHeaders(userA.token),
      data: { is_deleted: true, body: '' },
      failOnStatusCode: false,
    })
    expect(del.status()).toBe(200)

    // Attack 1: un-delete. The ratchet coerces is_deleted back to true (and body
    // to '', which the CHECK requires for a deleted row): either 200-coerced or a
    // 4xx CHECK violation. Either way it stays deleted with body ''.
    const revive = await api.patch(`${API_URL}/rest/v1/forum_posts?id=eq.${id}`, {
      headers: authHeaders(userA.token),
      data: { is_deleted: false },
      failOnStatusCode: false,
    })
    expect([200, 400].includes(revive.status())).toBeTruthy()

    // Attack 2: repopulate the body.
    const repop = await api.patch(`${API_URL}/rest/v1/forum_posts?id=eq.${id}`, {
      headers: authHeaders(userA.token),
      data: { body: 'arbitrary revived text', is_edited: true },
      failOnStatusCode: false,
    })
    expect([200, 400].includes(repop.status())).toBeTruthy()

    const check = await api.get(
      `${API_URL}/rest/v1/forum_posts?id=eq.${id}&select=is_deleted,body`,
      { headers: { apikey: ANON_KEY } },
    )
    const [row] = await check.json()
    expect(row.is_deleted, 'ratchet held: still deleted').toBe(true)
    expect(row.body, 'body NOT repopulated — stays blank').toBe('')
  })

  // -------------------------------------------------------------------------
  // (c) + (d) MODERATOR can pin/lock/delete; non-mod can't reply to a locked
  //     thread. Promote B to moderator via the privileged SQL path.
  // -------------------------------------------------------------------------
  test('(c) a MODERATOR can pin + lock a thread and soft-delete any post', async () => {
    test.skip(!SERVICE_KEY, 'requires SUPABASE_SERVICE_ROLE_KEY for the promote step')

    // Promote B to moderator. `role` is not in any PostgREST grant, so even the
    // service_role REST client can't PATCH it — use a privileged SQL UPDATE as
    // the postgres superuser via the local container (bypasses RLS + grants).
    const verify = execFileSync(
      'docker',
      [
        'exec',
        DB_CONTAINER,
        'psql',
        '-U',
        'postgres',
        '-d',
        'postgres',
        '-tAc',
        `update public.profiles set role='moderator' where id='${userB.userId}'; select role from public.profiles where id='${userB.userId}';`,
      ],
      { encoding: 'utf8' },
    )
    expect(verify, 'B is now a moderator').toMatch(/moderator/)

    // MOD can pin A's thread.
    const pin = await api.patch(`${API_URL}/rest/v1/forum_threads?id=eq.${threadId}`, {
      headers: authHeaders(userB.token),
      data: { is_pinned: true },
      failOnStatusCode: false,
    })
    expect(pin.status()).toBe(200)
    let check = await api.get(
      `${API_URL}/rest/v1/forum_threads?id=eq.${threadId}&select=is_pinned`,
      { headers: { apikey: ANON_KEY } },
    )
    expect((await check.json())[0].is_pinned).toBe(true)

    // MOD can lock A's thread.
    const lock = await api.patch(`${API_URL}/rest/v1/forum_threads?id=eq.${threadId}`, {
      headers: authHeaders(userB.token),
      data: { is_locked: true },
      failOnStatusCode: false,
    })
    expect(lock.status()).toBe(200)
    check = await api.get(
      `${API_URL}/rest/v1/forum_threads?id=eq.${threadId}&select=is_locked`,
      { headers: { apikey: ANON_KEY } },
    )
    expect((await check.json())[0].is_locked).toBe(true)

    // MOD can soft-delete A's first post (a post they do NOT own).
    const del = await api.patch(`${API_URL}/rest/v1/forum_posts?id=eq.${firstPostId}`, {
      headers: authHeaders(userB.token),
      data: { is_deleted: true, body: '' },
      failOnStatusCode: false,
    })
    expect(del.status()).toBe(200)
    check = await api.get(
      `${API_URL}/rest/v1/forum_posts?id=eq.${firstPostId}&select=is_deleted`,
      { headers: { apikey: ANON_KEY } },
    )
    expect((await check.json())[0].is_deleted).toBe(true)
  })

  test('(c2) a MODERATOR can reply to a LOCKED thread', async () => {
    test.skip(!SERVICE_KEY, 'depends on (c) promoting B to moderator')
    // The thread is locked from (c). B (now a moderator) can still post.
    const res = await api.post(`${API_URL}/rest/v1/forum_posts`, {
      headers: authHeaders(userB.token),
      data: { thread_id: threadId, user_id: userB.userId, body: 'mod note in locked thread' },
      failOnStatusCode: false,
    })
    expect(res.status(), 'moderator may post in a locked thread').toBe(201)
  })

  test('(d) a NON-MOD cannot reply to a LOCKED thread via raw PostgREST', async () => {
    test.skip(!SERVICE_KEY, 'depends on (c) locking the thread')
    // A is NOT a moderator; the thread is locked. The INSERT policy's locked
    // subquery rejects the post.
    const res = await api.post(`${API_URL}/rest/v1/forum_posts`, {
      headers: authHeaders(userA.token),
      data: { thread_id: threadId, user_id: userA.userId, body: 'A tries to post in locked thread' },
      failOnStatusCode: false,
    })
    expect(res.status(), 'non-mod reply to a locked thread is rejected').toBe(403)
    const err = await res.json()
    expect(err.code).toBe('42501')
    expect(err.message).toMatch(/row-level security/i)
  })
})

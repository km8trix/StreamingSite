import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test, request as pwRequest } from '@playwright/test'
import seed from '../src/lib/data/seed.json'

// M3 Feature 2 — COMMENTS adversarial security e2e (LIVE local Supabase).
//
// This mirrors the auth role-escalation check that caught a real bug: instead of
// trusting the server action / RLS by reading the code, we hit PostgREST DIRECTLY
// with a real user's JWT and prove the database REJECTS the abuse.
//
// We create two fresh users (A and B) through the live GoTrue auth endpoint (same
// path the app uses), have each post a legit comment, then — as user A — attempt
// the two attacks the contract calls out:
//   (a) POST a comment SPOOFING user_id = B (post AS someone else),
//   (b) EDIT / soft-delete / hard-delete B's comment (tamper another user's row).
// Both must be REJECTED: (a) a 4xx RLS violation; (b) an affected-row count of 0
// (RLS USING filters the row out, so the PATCH/DELETE matches nothing) with B's
// comment verifiably unchanged afterwards.
//
// These talk straight to Supabase (no page navigation), so they don't depend on
// the UI and are fast + deterministic. Rows persist; `npx supabase db reset`
// wipes accounts + comments.

// Load the live Supabase keys. Playwright runs test files in plain Node, which
// does NOT auto-load .env.local (only Next does), so we parse it ourselves —
// preferring an already-set process.env, then `.env.local`. This keeps the
// dependency surface to zero (no dotenv install) and isolates the change to this
// spec rather than the shared playwright.config.ts.
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
const API_URL = (
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  env.NEXT_PUBLIC_SUPABASE_URL ??
  'http://127.0.0.1:54321'
).replace(/\/$/, '')
const SHOW_ID = (seed as { shows: { id: string }[] }).shows[0].id

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
    data: {
      email: `adv.${label}+${stamp}@example.com`,
      password: 'secret123',
    },
  })
  expect(res.ok(), `signup for ${label} should succeed`).toBeTruthy()
  const body = await res.json()
  const token = body.access_token as string
  const userId = (body.user?.id ?? body.id) as string
  expect(token, 'signup returns an access_token (confirmations disabled)').toBeTruthy()
  expect(userId, 'signup returns the new user id').toBeTruthy()
  return { token, userId }
}

// Post a comment as a user. `asUserId` is the user_id sent in the body — normally
// the poster's own id, but the spoof test passes someone else's on purpose.
function postComment(
  api: import('@playwright/test').APIRequestContext,
  token: string,
  asUserId: string,
  body: string,
) {
  return api.post(`${API_URL}/rest/v1/comments`, {
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    data: { show_id: SHOW_ID, user_id: asUserId, body },
    failOnStatusCode: false,
  })
}

test.describe('Comments — adversarial RLS (cannot act as another user)', () => {
  // These hit the DB directly and create persistent rows; serialize to keep the
  // setup readable and avoid signup rate noise.
  test.describe.configure({ mode: 'serial' })

  test.skip(!ANON_KEY, 'requires live Supabase env (NEXT_PUBLIC_SUPABASE_ANON_KEY)')

  let api: import('@playwright/test').APIRequestContext
  let userA: User
  let userB: User
  let commentB: string // id of B's legit comment

  test.beforeAll(async () => {
    api = await pwRequest.newContext()
    userA = await signUpUser(api, 'A')
    userB = await signUpUser(api, 'B')

    // B posts a legitimate comment (own user_id) — this is the target row.
    const res = await postComment(api, userB.token, userB.userId, 'B legit comment')
    expect(res.status(), 'B can post their own comment').toBe(201)
    const rows = await res.json()
    commentB = rows[0].id
    expect(commentB).toBeTruthy()
  })

  test.afterAll(async () => {
    await api.dispose()
  })

  test('a user CAN post their own comment (baseline — RLS allows the legit case)', async () => {
    const res = await postComment(api, userA.token, userA.userId, 'A legit comment')
    expect(res.status()).toBe(201)
    const rows = await res.json()
    expect(rows[0].user_id).toBe(userA.userId)
  })

  test('(a) a user CANNOT post a comment spoofing another user_id', async () => {
    // A authenticates as A but sends user_id = B → RLS WITH CHECK (user_id =
    // auth.uid()) must reject. Posting AS someone else is the contract's
    // critical requirement.
    const res = await postComment(api, userA.token, userB.userId, 'A pretending to be B')
    expect(res.status(), 'spoofed-author insert is rejected').toBe(403)
    const err = await res.json()
    expect(err.code, 'RLS policy violation code').toBe('42501')
    expect(err.message).toMatch(/row-level security/i)

    // Nothing attributed to B (besides B's own legit comment) was created.
    const check = await api.get(
      `${API_URL}/rest/v1/comments?user_id=eq.${userB.userId}&body=eq.A pretending to be B&select=id`,
      { headers: { apikey: ANON_KEY } },
    )
    expect(await check.json()).toEqual([])
  })

  test('(a2) an anonymous (no-JWT) client CANNOT insert a comment at all', async () => {
    // No Authorization header → anon role, which has no INSERT policy/grant.
    const res = await api.post(`${API_URL}/rest/v1/comments`, {
      headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
      data: { show_id: SHOW_ID, user_id: userB.userId, body: 'anon spoof' },
      failOnStatusCode: false,
    })
    expect(res.ok()).toBeFalsy()
    expect(res.status()).toBeGreaterThanOrEqual(400)
  })

  test("(b1) a user CANNOT edit another user's comment (PATCH body -> 0 rows)", async () => {
    // A PATCHes B's comment id. RLS USING (auth.uid() = user_id) excludes the
    // row from A's update set, so PostgREST returns an empty representation
    // (0 rows affected) — the comment is not modified.
    const res = await api.patch(`${API_URL}/rest/v1/comments?id=eq.${commentB}`, {
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${userA.token}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      data: { body: 'A hijacked B comment', is_edited: true },
      failOnStatusCode: false,
    })
    // 0 rows updated — represented as an empty array.
    expect(await res.json()).toEqual([])

    // B's comment is verifiably untouched.
    const check = await api.get(
      `${API_URL}/rest/v1/comments?id=eq.${commentB}&select=body,is_edited,is_deleted`,
      { headers: { apikey: ANON_KEY } },
    )
    const [row] = await check.json()
    expect(row.body).toBe('B legit comment')
    expect(row.is_edited).toBe(false)
    expect(row.is_deleted).toBe(false)
  })

  test("(b2) a user CANNOT soft-delete another user's comment (PATCH is_deleted -> 0 rows)", async () => {
    const res = await api.patch(`${API_URL}/rest/v1/comments?id=eq.${commentB}`, {
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${userA.token}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      data: { is_deleted: true },
      failOnStatusCode: false,
    })
    expect(await res.json()).toEqual([])

    const check = await api.get(
      `${API_URL}/rest/v1/comments?id=eq.${commentB}&select=is_deleted`,
      { headers: { apikey: ANON_KEY } },
    )
    const [row] = await check.json()
    expect(row.is_deleted).toBe(false) // still not deleted
  })

  test("(b3) a user CANNOT hard-delete another user's comment (DELETE -> 0 rows)", async () => {
    const res = await api.delete(`${API_URL}/rest/v1/comments?id=eq.${commentB}`, {
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${userA.token}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      failOnStatusCode: false,
    })
    expect(await res.json()).toEqual([])

    // The row still exists.
    const check = await api.get(
      `${API_URL}/rest/v1/comments?id=eq.${commentB}&select=id`,
      { headers: { apikey: ANON_KEY } },
    )
    expect(await check.json()).toEqual([{ id: commentB }])
  })

  test("(b4) a user CANNOT re-own/re-key another user's comment via user_id PATCH", async () => {
    // Even targeting only the ownership column: not in A's update set (RLS) AND
    // user_id is not in the column-restricted UPDATE grant. Either way: rejected
    // or 0-rows; B's ownership is preserved.
    const res = await api.patch(`${API_URL}/rest/v1/comments?id=eq.${commentB}`, {
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${userA.token}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      data: { user_id: userA.userId },
      failOnStatusCode: false,
    })
    // Column-restricted grant => "permission denied for column" (403), OR the
    // RLS row filter => 0 rows ([]). Accept either; the invariant is that B
    // still owns the comment afterwards.
    if (res.status() === 200) {
      expect(await res.json()).toEqual([])
    } else {
      expect(res.status()).toBeGreaterThanOrEqual(400)
    }
    const check = await api.get(
      `${API_URL}/rest/v1/comments?id=eq.${commentB}&select=user_id`,
      { headers: { apikey: ANON_KEY } },
    )
    const [row] = await check.json()
    expect(row.user_id).toBe(userB.userId)
  })
})

// ---------------------------------------------------------------------------
// Content-integrity ratchet (M3 COMMENTS hardening).
//
// The cross-user block above proves you can't tamper with SOMEONE ELSE's row.
// These prove you can't abuse content integrity on YOUR OWN row either: the
// column grant must include is_deleted / is_edited (so the server actions can
// soft-delete / mark-edited), but a BEFORE UPDATE trigger enforces the state
// invariants column grants can't express:
//   - is_deleted is a ONE-WAY RATCHET: once deleted, a raw PATCH can't un-delete
//     or repopulate it (the MEDIUM finding);
//   - is_edited is MONOTONIC: a raw PATCH can't erase the "(edited)" marker
//     (the LOW finding).
// We act as the comment's OWNER (so RLS allows the row through) and prove the DB
// coerces the values back to the safe state regardless.
// ---------------------------------------------------------------------------
test.describe('Comments — content-integrity ratchet (cannot un-delete / un-edit own row)', () => {
  test.describe.configure({ mode: 'serial' })
  test.skip(!ANON_KEY, 'requires live Supabase env (NEXT_PUBLIC_SUPABASE_ANON_KEY)')

  let api: import('@playwright/test').APIRequestContext
  let user: User

  // PATCH the owner's own comment with the given body fields.
  function patchOwn(commentId: string, data: Record<string, unknown>) {
    return api.patch(`${API_URL}/rest/v1/comments?id=eq.${commentId}`, {
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${user.token}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      data,
      failOnStatusCode: false,
    })
  }

  async function fetchRow(commentId: string) {
    const res = await api.get(
      `${API_URL}/rest/v1/comments?id=eq.${commentId}&select=body,is_edited,is_deleted`,
      { headers: { apikey: ANON_KEY } },
    )
    const [row] = await res.json()
    return row as { body: string; is_edited: boolean; is_deleted: boolean }
  }

  test.beforeAll(async () => {
    api = await pwRequest.newContext()
    user = await signUpUser(api, 'ratchet')
  })

  test.afterAll(async () => {
    await api.dispose()
  })

  test('MEDIUM: a soft-deleted comment CANNOT be un-deleted or repopulated', async () => {
    // Post -> soft-delete (is_deleted=true, body blanked) as the owner.
    const created = await postComment(api, user.token, user.userId, 'will be deleted')
    expect(created.status()).toBe(201)
    const id = (await created.json())[0].id as string

    const del = await patchOwn(id, { is_deleted: true, body: '' })
    expect(del.status(), 'owner can soft-delete own comment').toBe(200)
    let row = await fetchRow(id)
    expect(row.is_deleted).toBe(true)
    expect(row.body).toBe('')

    // Attack step 1: PATCH {is_deleted:false} to revive it. The ratchet coerces
    // is_deleted back to true (and body to '', which the CHECK requires for a
    // deleted row), so either the row stays deleted (200, coerced) or the empty
    // body trips the CHECK (4xx). Either way the row stays deleted with body ''.
    const revive = await patchOwn(id, { is_deleted: false })
    expect([200, 400].includes(revive.status())).toBeTruthy()
    row = await fetchRow(id)
    expect(row.is_deleted, 'ratchet held: still deleted after un-delete attempt').toBe(true)
    expect(row.body).toBe('')

    // Attack step 2: PATCH {body:'anything', is_edited:true} to repopulate it.
    // The trigger forces body back to '' (CHECK then rejects the non-empty body
    // turned empty), so the deleted comment never becomes live arbitrary text.
    const repopulate = await patchOwn(id, { body: 'arbitrary revived text', is_edited: true })
    expect([200, 400].includes(repopulate.status())).toBeTruthy()
    row = await fetchRow(id)
    expect(row.is_deleted, 'still deleted after repopulate attempt').toBe(true)
    expect(row.body, 'body NOT repopulated — stays blank').toBe('')
  })

  test('LOW: the is_edited marker CANNOT be erased once set', async () => {
    // Post -> edit (is_edited becomes true) as the owner.
    const created = await postComment(api, user.token, user.userId, 'original')
    expect(created.status()).toBe(201)
    const id = (await created.json())[0].id as string

    const edit = await patchOwn(id, { body: 'edited body', is_edited: true })
    expect(edit.status()).toBe(200)
    let row = await fetchRow(id)
    expect(row.is_edited).toBe(true)
    expect(row.body).toBe('edited body')

    // Attack: PATCH {is_edited:false} to hide that an edit happened. The trigger
    // coerces is_edited back to true.
    const unedit = await patchOwn(id, { is_edited: false })
    expect(unedit.status()).toBe(200)
    row = await fetchRow(id)
    expect(row.is_edited, 'edit marker preserved after un-edit attempt').toBe(true)
  })

  test('legit flow still works: post -> edit -> soft-delete', async () => {
    const created = await postComment(api, user.token, user.userId, 'legit original')
    expect(created.status()).toBe(201)
    const id = (await created.json())[0].id as string

    // Edit: body changes, is_edited becomes true.
    const edit = await patchOwn(id, { body: 'legit edited', is_edited: true })
    expect(edit.status()).toBe(200)
    let row = await fetchRow(id)
    expect(row.body).toBe('legit edited')
    expect(row.is_edited).toBe(true)
    expect(row.is_deleted).toBe(false)

    // Soft-delete: is_deleted becomes true, body blanked.
    const del = await patchOwn(id, { is_deleted: true, body: '' })
    expect(del.status()).toBe(200)
    row = await fetchRow(id)
    expect(row.is_deleted).toBe(true)
    expect(row.body).toBe('')
    // The edit marker also survives the delete (monotonic).
    expect(row.is_edited).toBe(true)
  })
})

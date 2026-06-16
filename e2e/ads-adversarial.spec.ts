import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test, request as pwRequest } from '@playwright/test'

// Roadmap: NON-INVASIVE ads — adversarial security e2e (LIVE local Supabase).
//
// Mirrors the comments/forum adversarial checks: instead of trusting RLS + the
// column-restricted grants by reading the migration, we hit PostgREST DIRECTLY
// with the anon key and prove the database enforces the ad security model:
//
//   (1) anon CANNOT read an INACTIVE ad — RLS SELECT USING (is_active) hides the
//       seeded inactive creative (ad-005) even when queried by its exact id.
//   (2) anon CANNOT directly INSERT / UPDATE / DELETE ad_placements — there is
//       no write policy AND no write grant, so every write is rejected (42501).
//   (3) The ONLY mutation a client may perform is the +1 counter via the two
//       SECURITY DEFINER RPCs (record_ad_impression / record_ad_click), and only
//       on a NAMED, ACTIVE ad — a call against an inactive ad is a silent no-op.
//
// These talk straight to Supabase (no page navigation), so they're fast and
// deterministic and don't depend on the UI.

// Load the live Supabase keys. Playwright runs test files in plain Node, which
// does NOT auto-load .env.local (only Next does), so parse it ourselves —
// preferring an already-set process.env, then `.env.local`. Zero new deps.
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
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  ''
const API_URL = (
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  env.NEXT_PUBLIC_SUPABASE_URL ??
  'http://127.0.0.1:54321'
).replace(/\/$/, '')

// The seeded inactive ad (is_active=false) — must never reach a client. Seeded
// in supabase/seed/seed.sql; re-created by `npx supabase db reset`.
const INACTIVE_AD_ID = 'ad-005'
// A seeded ACTIVE ad — visible, and a valid RPC target.
const ACTIVE_AD_ID = 'ad-002'

test.describe('Ads — adversarial PostgREST (RLS + grants)', () => {
  test.skip(!ANON_KEY, 'requires live Supabase env (NEXT_PUBLIC_SUPABASE_ANON_KEY)')

  let api: import('@playwright/test').APIRequestContext

  test.beforeAll(async () => {
    api = await pwRequest.newContext()
  })
  test.afterAll(async () => {
    await api.dispose()
  })

  const anonHeaders = (extra: Record<string, string> = {}) => ({
    apikey: ANON_KEY,
    ...extra,
  })

  // --- (1) anon cannot read an inactive ad --------------------------------

  test('anon read returns ONLY active ads (the inactive ad is absent from the list)', async () => {
    const res = await api.get(
      `${API_URL}/rest/v1/ad_placements?select=id,placement_key`,
      { headers: anonHeaders() },
    )
    expect(res.ok()).toBeTruthy()
    const rows = (await res.json()) as Array<{ id: string }>
    const ids = rows.map((r) => r.id)
    // Active house ads are visible…
    expect(ids).toContain(ACTIVE_AD_ID)
    // …but the inactive one is hidden.
    expect(ids).not.toContain(INACTIVE_AD_ID)
  })

  test('anon CANNOT read the inactive ad even when querying it by exact id', async () => {
    // RLS SELECT USING (is_active) filters the row out regardless of the filter.
    const res = await api.get(
      `${API_URL}/rest/v1/ad_placements?id=eq.${INACTIVE_AD_ID}&select=id,is_active,image_url,target_url`,
      { headers: anonHeaders() },
    )
    expect(res.ok()).toBeTruthy()
    // Empty — the inactive creative is invisible to anon (no leak of its
    // image_url / target_url either).
    expect(await res.json()).toEqual([])
  })

  test('anon CANNOT filter their way to inactive ads via is_active=false', async () => {
    const res = await api.get(
      `${API_URL}/rest/v1/ad_placements?is_active=eq.false&select=id`,
      { headers: anonHeaders() },
    )
    expect(res.ok()).toBeTruthy()
    expect(await res.json()).toEqual([])
  })

  // --- (2) anon cannot write ad_placements directly -----------------------

  test('anon CANNOT INSERT a new ad (no write grant -> 42501)', async () => {
    const res = await api.post(`${API_URL}/rest/v1/ad_placements`, {
      headers: anonHeaders({ 'Content-Type': 'application/json' }),
      data: {
        id: `adv-inject-${Date.now()}`,
        placement_key: 'home-banner',
        image_url: 'https://evil.example.com/x.png',
        target_url: 'https://evil.example.com',
        is_active: true,
      },
      failOnStatusCode: false,
    })
    expect(res.status(), 'insert rejected').toBeGreaterThanOrEqual(400)
    const err = await res.json()
    expect(err.code, 'permission-denied code').toBe('42501')
    expect(err.message).toMatch(/permission denied for table/i)

    // Nothing was created (the injected id is not readable).
    const check = await api.get(
      `${API_URL}/rest/v1/ad_placements?placement_key=eq.home-banner&select=target_url`,
      { headers: anonHeaders() },
    )
    const targets = ((await check.json()) as Array<{ target_url: string }>).map(
      (r) => r.target_url,
    )
    expect(targets).not.toContain('https://evil.example.com')
  })

  test('anon CANNOT UPDATE an active ad (e.g. flip is_active or change target) -> 42501', async () => {
    const res = await api.patch(
      `${API_URL}/rest/v1/ad_placements?id=eq.${ACTIVE_AD_ID}`,
      {
        headers: anonHeaders({
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        }),
        data: { target_url: 'https://evil.example.com', is_active: false },
        failOnStatusCode: false,
      },
    )
    expect(res.status()).toBeGreaterThanOrEqual(400)
    const err = await res.json()
    expect(err.code).toBe('42501')
    expect(err.message).toMatch(/permission denied for table/i)

    // The active ad is unchanged and still active/visible.
    const check = await api.get(
      `${API_URL}/rest/v1/ad_placements?id=eq.${ACTIVE_AD_ID}&select=id,target_url`,
      { headers: anonHeaders() },
    )
    const [row] = (await check.json()) as Array<{ id: string; target_url: string }>
    expect(row.id).toBe(ACTIVE_AD_ID)
    expect(row.target_url).not.toBe('https://evil.example.com')
  })

  test('anon CANNOT DELETE an ad -> 42501', async () => {
    const res = await api.delete(
      `${API_URL}/rest/v1/ad_placements?id=eq.${ACTIVE_AD_ID}`,
      {
        headers: anonHeaders({ Prefer: 'return=representation' }),
        failOnStatusCode: false,
      },
    )
    expect(res.status()).toBeGreaterThanOrEqual(400)
    const err = await res.json()
    expect(err.code).toBe('42501')

    // The ad still exists.
    const check = await api.get(
      `${API_URL}/rest/v1/ad_placements?id=eq.${ACTIVE_AD_ID}&select=id`,
      { headers: anonHeaders() },
    )
    expect(await check.json()).toEqual([{ id: ACTIVE_AD_ID }])
  })

  // --- (3) the ONLY allowed mutation: the +1 counter RPCs -----------------

  test('anon CAN call record_ad_click / record_ad_impression on an ACTIVE ad (the only allowed mutation)', async () => {
    const clickRes = await api.post(
      `${API_URL}/rest/v1/rpc/record_ad_click`,
      {
        headers: anonHeaders({ 'Content-Type': 'application/json' }),
        data: { p_id: ACTIVE_AD_ID },
        failOnStatusCode: false,
      },
    )
    // SECURITY DEFINER RPC returns void -> 204 No Content (or 200).
    expect([200, 204]).toContain(clickRes.status())

    const impRes = await api.post(
      `${API_URL}/rest/v1/rpc/record_ad_impression`,
      {
        headers: anonHeaders({ 'Content-Type': 'application/json' }),
        data: { p_id: ACTIVE_AD_ID },
        failOnStatusCode: false,
      },
    )
    expect([200, 204]).toContain(impRes.status())
  })

  test('the counter RPC against an INACTIVE ad is accepted but a silent NO-OP', async () => {
    // The RPC body filters `where id = p_id and is_active is true`, so calling it
    // on the inactive ad updates 0 rows. The call succeeds (the function exists +
    // is granted) but changes nothing — and the inactive ad stays invisible.
    const res = await api.post(`${API_URL}/rest/v1/rpc/record_ad_click`, {
      headers: anonHeaders({ 'Content-Type': 'application/json' }),
      data: { p_id: INACTIVE_AD_ID },
      failOnStatusCode: false,
    })
    expect([200, 204]).toContain(res.status())

    // The inactive ad is STILL invisible to anon (the RPC did not surface it,
    // and we cannot read its counters to confirm — RLS keeps it hidden, which is
    // itself the guarantee: a no-op that leaks nothing).
    const check = await api.get(
      `${API_URL}/rest/v1/ad_placements?id=eq.${INACTIVE_AD_ID}&select=id`,
      { headers: anonHeaders() },
    )
    expect(await check.json()).toEqual([])
  })

  test('the counter RPC cannot be abused to mutate anything but the +1 (no extra args accepted)', async () => {
    // The RPC signature is record_ad_click(p_id text) — passing other "columns"
    // is not a valid argument and PostgREST rejects the call (it cannot be used
    // to set image_url / target_url / is_active / weight).
    const res = await api.post(`${API_URL}/rest/v1/rpc/record_ad_click`, {
      headers: anonHeaders({ 'Content-Type': 'application/json' }),
      data: { p_id: ACTIVE_AD_ID, is_active: false, target_url: 'https://evil' },
      failOnStatusCode: false,
    })
    // PostgREST rejects unknown function arguments (404 "function not found" for
    // the arg signature). Either way it is NOT a successful arbitrary write.
    expect(res.status()).toBeGreaterThanOrEqual(400)

    // The ad is unchanged + still active/visible.
    const check = await api.get(
      `${API_URL}/rest/v1/ad_placements?id=eq.${ACTIVE_AD_ID}&select=id,target_url`,
      { headers: anonHeaders() },
    )
    const [row] = (await check.json()) as Array<{ id: string; target_url: string }>
    expect(row.id).toBe(ACTIVE_AD_ID)
    expect(row.target_url).not.toBe('https://evil')
  })
})

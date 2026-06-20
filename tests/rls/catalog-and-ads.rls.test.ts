import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { anonClient, cleanup, db, newUser, type TestUser } from './_helpers'

// Catalog tables (shows/genres/episodes/airing_slots/show_genres) are PUBLIC
// read + write-locked to service-side. ad_placements is read-filtered to active
// rows (USING is_active) and mutated only via SECURITY DEFINER counter RPCs.

describe('catalog + ads RLS', () => {
  let user: TestUser

  beforeAll(async () => {
    user = await newUser()
  })
  afterAll(cleanup)

  const publicTables = ['shows', 'genres', 'episodes', 'airing_slots', 'show_genres']

  it('lets anyone read the catalog', async () => {
    const anon = anonClient()
    for (const t of publicTables) {
      const { data, error } = await anon.from(t).select('*').limit(1)
      expect(error, `select ${t}`).toBeNull()
      expect((data ?? []).length, `rows in ${t}`).toBeGreaterThan(0)
    }
  })

  it('write-locks the catalog against anon and authenticated', async () => {
    const { error: anonErr } = await anonClient()
      .from('shows')
      .insert({ id: 'hax', slug: 'hax', title: 'Hax' })
    expect(anonErr).not.toBeNull()

    const { error: authErr } = await user.client
      .from('shows')
      .insert({ id: 'hax2', slug: 'hax2', title: 'Hax2' })
    expect(authErr).not.toBeNull()
  })

  it('hides inactive ads from clients (USING is_active)', async () => {
    const { rows: inactive } = await db().query<{ id: string }>(
      'select id from public.ad_placements where not is_active limit 1',
    )
    expect(inactive.length, 'need a seeded inactive ad').toBe(1)
    const inactiveId = inactive[0].id

    const { data, error } = await anonClient().from('ad_placements').select('id')
    expect(error).toBeNull()
    const visibleIds = (data as Array<{ id: string }>).map((r) => r.id)
    expect(visibleIds).not.toContain(inactiveId)
    expect(visibleIds.length).toBeGreaterThan(0) // active ads are visible
  })

  it('increments counters only for active ads via the RPC', async () => {
    const { rows: active } = await db().query<{ id: string; impressions: number }>(
      'select id, impressions::int as impressions from public.ad_placements where is_active order by id limit 1',
    )
    const { rows: inactive } = await db().query<{ id: string; impressions: number }>(
      'select id, impressions::int as impressions from public.ad_placements where not is_active limit 1',
    )
    const activeId = active[0].id
    const before = active[0].impressions

    // anon is granted EXECUTE on the counter RPCs.
    const { error } = await anonClient().rpc('record_ad_impression', { p_id: activeId })
    expect(error).toBeNull()

    const { rows: afterActive } = await db().query<{ impressions: number }>(
      'select impressions::int as impressions from public.ad_placements where id = $1',
      [activeId],
    )
    expect(afterActive[0].impressions).toBe(before + 1)

    // Inactive ad: the RPC is a no-op (WHERE is_active is true).
    const inactiveId = inactive[0].id
    const inactiveBefore = inactive[0].impressions
    await anonClient().rpc('record_ad_impression', { p_id: inactiveId })
    const { rows: afterInactive } = await db().query<{ impressions: number }>(
      'select impressions::int as impressions from public.ad_placements where id = $1',
      [inactiveId],
    )
    expect(afterInactive[0].impressions).toBe(inactiveBefore)
  })
})

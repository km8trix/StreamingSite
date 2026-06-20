import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { anonClient, anyShowId, cleanup, db, newUser, type TestUser } from './_helpers'

// show_view_events (0011): the raw who-watched-what log is FULLY PRIVATE — RLS is
// on with NO policies and NO table grant to anon/authenticated. The only surface
// is two SECURITY DEFINER RPCs: record_show_view (write) and get_top_anime (read
// aggregate). Guests record with a null user_id.

describe('show_view_events RLS', () => {
  let alice: TestUser
  let showId: string

  beforeAll(async () => {
    showId = await anyShowId()
    alice = await newUser()
  })
  afterAll(cleanup)

  it('exposes no direct table access to anon or authenticated', async () => {
    const { error: anonErr } = await anonClient().from('show_view_events').select('*')
    expect(anonErr?.code).toBe('42501')
    const { error: authErr } = await alice.client.from('show_view_events').select('*')
    expect(authErr?.code).toBe('42501')
  })

  it('records a guest view (null user_id) via the RPC', async () => {
    const { error } = await anonClient().rpc('record_show_view', { p_show_id: showId })
    expect(error).toBeNull()
    const { rows } = await db().query(
      'select count(*)::int as n from public.show_view_events where show_id = $1 and user_id is null',
      [showId],
    )
    expect(rows[0].n).toBeGreaterThanOrEqual(1)
  })

  it('records a signed-in view stamped with the caller\'s id', async () => {
    const { error } = await alice.client.rpc('record_show_view', { p_show_id: showId })
    expect(error).toBeNull()
    const { rows } = await db().query(
      'select count(*)::int as n from public.show_view_events where show_id = $1 and user_id = $2',
      [showId, alice.id],
    )
    expect(rows[0].n).toBe(1)
  })

  it('aggregates rankings via get_top_anime without leaking raw rows', async () => {
    const { data, error } = await anonClient().rpc('get_top_anime', {
      p_since: '1970-01-01T00:00:00Z',
      p_limit: 50,
    })
    expect(error).toBeNull()
    const row = (data as Array<{ id: string; views: number }>).find((r) => r.id === showId)
    expect(row).toBeDefined()
    expect(Number(row!.views)).toBeGreaterThanOrEqual(1)
  })
})

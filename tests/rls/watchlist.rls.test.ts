import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  anonClient,
  anyShowId,
  cleanup,
  db,
  newUser,
  type TestUser,
} from './_helpers'

// watchlist (0012): PRIVATE per-user. Reads/deletes scoped to auth.uid(); anon
// has NO table grant; writes only via the SECURITY DEFINER add_to_watchlist RPC,
// which pins user_id = auth.uid() and validates the show exists.

describe('watchlist RLS', () => {
  let alice: TestUser
  let bob: TestUser
  let showId: string

  beforeAll(async () => {
    showId = await anyShowId()
    alice = await newUser()
    bob = await newUser()
  })
  afterAll(cleanup)

  it('lets a user save a show via the RPC and read their own row', async () => {
    const { error: rpcErr } = await alice.client.rpc('add_to_watchlist', {
      p_show_id: showId,
    })
    expect(rpcErr).toBeNull()

    const { data, error } = await alice.client
      .from('watchlist')
      .select('show_id, user_id')
    expect(error).toBeNull()
    expect(data).toEqual([{ show_id: showId, user_id: alice.id }])
  })

  it('does not leak one user\'s rows to another authenticated user', async () => {
    const { data, error } = await bob.client.from('watchlist').select('*')
    // Bob HAS the select grant, but RLS filters to his own (empty) rows.
    expect(error).toBeNull()
    expect(data).toEqual([])
  })

  it('denies anon any access to the table', async () => {
    const { error } = await anonClient().from('watchlist').select('*')
    expect(error).not.toBeNull() // permission denied for table (no anon grant)
    expect(error?.code).toBe('42501')
  })

  it('blocks a direct INSERT — the RPC is the only write path', async () => {
    const { error } = await alice.client
      .from('watchlist')
      .insert({ user_id: alice.id, show_id: showId })
    expect(error).not.toBeNull() // no INSERT grant to authenticated
  })

  it('RPC pins ownership — a forged user_id is impossible (no insert surface)', async () => {
    // Bob saves via RPC; the row must be owned by Bob, never Alice.
    const { error } = await bob.client.rpc('add_to_watchlist', { p_show_id: showId })
    expect(error).toBeNull()
    const { rows } = await db().query(
      'select user_id from public.watchlist where show_id = $1 and user_id = $2',
      [showId, bob.id],
    )
    expect(rows).toEqual([{ user_id: bob.id }])
  })

  it('rejects the RPC for an unauthenticated caller', async () => {
    const { error } = await anonClient().rpc('add_to_watchlist', { p_show_id: showId })
    expect(error).not.toBeNull() // raises 'not authenticated'
    expect(error?.message).toMatch(/not authenticated/i)
  })

  it('rejects the RPC for an unknown show (no dangling references)', async () => {
    const { error } = await alice.client.rpc('add_to_watchlist', {
      p_show_id: 'does-not-exist',
    })
    expect(error).not.toBeNull() // raises 'unknown show ...'
    expect(error?.message).toMatch(/unknown show/i)
  })

  it('lets a user delete their own row but not another user\'s', async () => {
    // Bob has a row from the ownership test; Alice cannot delete it.
    const { error: aErr } = await alice.client
      .from('watchlist')
      .delete()
      .eq('user_id', bob.id)
      .eq('show_id', showId)
    expect(aErr).toBeNull() // RLS makes it a 0-row no-op, not an error

    const { rows: still } = await db().query(
      'select user_id from public.watchlist where user_id = $1 and show_id = $2',
      [bob.id, showId],
    )
    expect(still).toEqual([{ user_id: bob.id }]) // Bob's row survived

    // Bob can delete his own.
    const { error: bErr } = await bob.client
      .from('watchlist')
      .delete()
      .eq('show_id', showId)
    expect(bErr).toBeNull()
    const { rows: gone } = await db().query(
      'select user_id from public.watchlist where user_id = $1',
      [bob.id],
    )
    expect(gone).toEqual([])
  })
})

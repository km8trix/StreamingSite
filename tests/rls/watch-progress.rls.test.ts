import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { anonClient, anyEpisode, cleanup, db, newUser, type TestUser } from './_helpers'

// watch_progress (0009): PRIVATE per-user. select/delete scoped to auth.uid();
// anon has NO grant; writes only via SECURITY DEFINER record_watch_progress,
// which pins user_id = auth.uid() and validates the episode belongs to the show.

describe('watch_progress RLS', () => {
  let alice: TestUser
  let bob: TestUser
  let showId: string
  let episodeId: string

  beforeAll(async () => {
    ;({ showId, episodeId } = await anyEpisode())
    alice = await newUser()
    bob = await newUser()
  })
  afterAll(cleanup)

  it('records progress via the RPC and lets the owner read their own row', async () => {
    // 10/100s = 10% — stored in-progress (below the 90% auto-advance threshold).
    const { error } = await alice.client.rpc('record_watch_progress', {
      p_show_id: showId,
      p_episode_id: episodeId,
      p_position_seconds: 10,
      p_duration_seconds: 100,
    })
    expect(error).toBeNull()

    const { data } = await alice.client
      .from('watch_progress')
      .select('show_id, user_id, position_seconds')
    expect(data).toEqual([{ show_id: showId, user_id: alice.id, position_seconds: 10 }])
  })

  it('isolates rows per user and denies anon entirely', async () => {
    const { data: bobRows, error: bobErr } = await bob.client
      .from('watch_progress')
      .select('*')
    expect(bobErr).toBeNull()
    expect(bobRows).toEqual([]) // RLS filters to Bob's own (none)

    const { error: anonErr } = await anonClient().from('watch_progress').select('*')
    expect(anonErr?.code).toBe('42501') // no anon grant
  })

  it('blocks a direct INSERT — the RPC is the only write path', async () => {
    const { error } = await alice.client
      .from('watch_progress')
      .insert({ user_id: alice.id, show_id: showId, episode_id: episodeId })
    expect(error).not.toBeNull()
  })

  it('rejects the RPC for an unauthenticated caller', async () => {
    const { error } = await anonClient().rpc('record_watch_progress', {
      p_show_id: showId,
      p_episode_id: episodeId,
      p_position_seconds: 5,
      p_duration_seconds: 100,
    })
    expect(error?.message).toMatch(/not authenticated/i)
  })

  it('rejects an episode that does not belong to the show (integrity)', async () => {
    const { error } = await alice.client.rpc('record_watch_progress', {
      p_show_id: showId,
      p_episode_id: 'not-a-real-episode',
      p_position_seconds: 5,
      p_duration_seconds: 100,
    })
    expect(error?.message).toMatch(/unknown episode/i)
  })

  it('lets a user delete their own progress but not another user\'s', async () => {
    await bob.client.rpc('record_watch_progress', {
      p_show_id: showId,
      p_episode_id: episodeId,
      p_position_seconds: 3,
      p_duration_seconds: 100,
    })
    // Alice cannot delete Bob's row.
    await alice.client.from('watch_progress').delete().eq('user_id', bob.id)
    const { rows: still } = await db().query(
      'select user_id from public.watch_progress where user_id = $1',
      [bob.id],
    )
    expect(still).toEqual([{ user_id: bob.id }])

    // Bob can delete his own.
    const { error } = await bob.client.from('watch_progress').delete().eq('show_id', showId)
    expect(error).toBeNull()
    const { rows: gone } = await db().query(
      'select 1 from public.watch_progress where user_id = $1',
      [bob.id],
    )
    expect(gone).toEqual([])
  })
})

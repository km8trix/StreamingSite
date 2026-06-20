import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { anonClient, anyShowId, cleanup, db, newUser, type TestUser } from './_helpers'

// comments (0004): PUBLIC read, authored writes. INSERT/UPDATE/DELETE scoped to
// auth.uid() = user_id; column-restricted grants; a BEFORE UPDATE trigger
// enforces a one-way soft-delete ratchet.

describe('comments RLS', () => {
  let alice: TestUser
  let bob: TestUser
  let showId: string

  beforeAll(async () => {
    showId = await anyShowId()
    alice = await newUser()
    bob = await newUser()
  })
  afterAll(cleanup)

  async function aliceComment(body = 'hi'): Promise<string> {
    const { data, error } = await alice.client
      .from('comments')
      .insert({ show_id: showId, user_id: alice.id, body })
      .select('id')
      .single()
    expect(error).toBeNull()
    return (data as { id: string }).id
  }

  it('lets a user post as themselves and everyone read it', async () => {
    const id = await aliceComment('first')
    // Public read: even anon sees it.
    const { data, error } = await anonClient().from('comments').select('id').eq('id', id)
    expect(error).toBeNull()
    expect(data).toEqual([{ id }])
  })

  it('rejects posting under a forged user_id (WITH CHECK auth.uid()=user_id)', async () => {
    const { error } = await alice.client
      .from('comments')
      .insert({ show_id: showId, user_id: bob.id, body: 'as bob' })
    expect(error?.code).toBe('42501')
  })

  it('denies anon any write', async () => {
    const { error } = await anonClient()
      .from('comments')
      .insert({ show_id: showId, user_id: alice.id, body: 'anon' })
    expect(error).not.toBeNull()
  })

  it('does not let another user edit or delete your comment', async () => {
    const id = await aliceComment('mine')
    await bob.client.from('comments').update({ body: 'hacked' }).eq('id', id)
    await bob.client.from('comments').delete().eq('id', id)
    const { rows } = await db().query(
      'select body, is_deleted from public.comments where id = $1',
      [id],
    )
    expect(rows).toEqual([{ body: 'mine', is_deleted: false }]) // untouched
  })

  it('enforces a one-way soft-delete ratchet (cannot un-delete or refill body)', async () => {
    const id = await aliceComment('to delete')
    // Owner soft-deletes.
    const { error: delErr } = await alice.client
      .from('comments')
      .update({ is_deleted: true })
      .eq('id', id)
    expect(delErr).toBeNull()

    // Owner tries to revert — the integrity trigger forces is_deleted/body back.
    await alice.client
      .from('comments')
      .update({ is_deleted: false, body: 'back' })
      .eq('id', id)
    const { rows } = await db().query(
      'select body, is_deleted from public.comments where id = $1',
      [id],
    )
    expect(rows).toEqual([{ body: '', is_deleted: true }])
  })
})

import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { cleanup, db, newUser, type TestUser } from './_helpers'

// forum_threads / forum_posts (0005): PUBLIC read, authored writes, plus a
// moderator escalation path via the SECURITY DEFINER is_moderator() helper.
// Authors may edit only their own content (and not pin/lock); moderators may
// edit/delete anyone's and post in locked threads.

describe('forum RLS', () => {
  let alice: TestUser
  let bob: TestUser
  let mod: TestUser
  let categoryId: string

  beforeAll(async () => {
    alice = await newUser()
    bob = await newUser()
    mod = await newUser('moderator')
    const { rows } = await db().query<{ id: string }>(
      'select id from public.forum_categories limit 1',
    )
    if (!rows[0]) throw new Error('no forum_categories seeded')
    categoryId = rows[0].id
  })
  afterAll(cleanup)

  async function thread(owner: TestUser, title = 'topic'): Promise<string> {
    const { data, error } = await owner.client
      .from('forum_threads')
      .insert({
        category_id: categoryId,
        user_id: owner.id,
        title,
        slug: `t-${randomUUID()}`,
        show_id: null,
      })
      .select('id')
      .single()
    expect(error).toBeNull()
    return (data as { id: string }).id
  }

  it('lets a user open a thread as themselves but not under a forged user_id', async () => {
    const id = await thread(alice)
    expect(id).toBeTruthy()

    const { error } = await alice.client.from('forum_threads').insert({
      category_id: categoryId,
      user_id: bob.id, // forged
      title: 'as bob',
      slug: `t-${randomUUID()}`,
    })
    expect(error?.code).toBe('42501')
  })

  it('does not let a non-author non-mod edit another\'s thread', async () => {
    const id = await thread(alice, 'alice title')
    await bob.client.from('forum_threads').update({ title: 'bob was here' }).eq('id', id)
    const { rows } = await db().query('select title from public.forum_threads where id = $1', [id])
    expect(rows[0].title).toBe('alice title')
  })

  it('forbids the author from pinning/locking their own thread', async () => {
    const id = await thread(alice)
    const { error } = await alice.client
      .from('forum_threads')
      .update({ is_pinned: true })
      .eq('id', id)
    expect(error?.code).toBe('42501') // WITH CHECK pins is_pinned for non-mods
    const { rows } = await db().query(
      'select is_pinned from public.forum_threads where id = $1',
      [id],
    )
    expect(rows[0].is_pinned).toBe(false)
  })

  it('lets a moderator pin and delete anyone\'s thread', async () => {
    const id = await thread(alice)
    const { error: pinErr } = await mod.client
      .from('forum_threads')
      .update({ is_pinned: true })
      .eq('id', id)
    expect(pinErr).toBeNull()

    const { error: delErr } = await mod.client.from('forum_threads').delete().eq('id', id)
    expect(delErr).toBeNull()
    const { rows } = await db().query('select 1 from public.forum_threads where id = $1', [id])
    expect(rows).toEqual([])
  })

  it('blocks non-mods from posting in a locked thread, but allows mods', async () => {
    const id = await thread(alice)
    await db().query('update public.forum_threads set is_locked = true where id = $1', [id])

    const { error: bobErr } = await bob.client
      .from('forum_posts')
      .insert({ thread_id: id, user_id: bob.id, body: 'sneaking in' })
    expect(bobErr?.code).toBe('42501')

    const { error: modErr } = await mod.client
      .from('forum_posts')
      .insert({ thread_id: id, user_id: mod.id, body: 'mod can post' })
    expect(modErr).toBeNull()
  })
})

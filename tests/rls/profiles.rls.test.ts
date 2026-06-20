import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { anonClient, cleanup, db, newUser, type TestUser } from './_helpers'

// profiles (0003/0008): PUBLIC read (usernames/avatars). A user may UPDATE only
// their OWN row, and only the (username, display_name, avatar_url) columns —
// `role` is NOT in the grant and is pinned by WITH CHECK, so no self-promotion.
// Rows are created by the SECURITY DEFINER handle_new_user trigger on signup.

describe('profiles RLS', () => {
  let alice: TestUser
  let bob: TestUser

  beforeAll(async () => {
    alice = await newUser()
    bob = await newUser()
  })
  afterAll(cleanup)

  it('auto-creates a profile row on signup (handle_new_user trigger)', async () => {
    const { rows } = await db().query(
      'select username, role from public.profiles where id = $1',
      [alice.id],
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].username).toBeTruthy()
    expect(rows[0].role).toBe('user')
  })

  it('is publicly readable', async () => {
    const { data, error } = await anonClient()
      .from('profiles')
      .select('id')
      .eq('id', alice.id)
    expect(error).toBeNull()
    expect(data).toEqual([{ id: alice.id }])
  })

  it('lets a user update their own profile', async () => {
    const { error } = await alice.client
      .from('profiles')
      .update({ display_name: 'Alice Updated' })
      .eq('id', alice.id)
    expect(error).toBeNull()
    const { rows } = await db().query(
      'select display_name from public.profiles where id = $1',
      [alice.id],
    )
    expect(rows[0].display_name).toBe('Alice Updated')
  })

  it('does not let a user update someone else\'s profile', async () => {
    await alice.client
      .from('profiles')
      .update({ display_name: 'pwned' })
      .eq('id', bob.id)
    const { rows } = await db().query(
      'select display_name from public.profiles where id = $1',
      [bob.id],
    )
    expect(rows[0].display_name).not.toBe('pwned')
  })

  it('forbids self-promotion — `role` is not a writable column', async () => {
    const { error } = await alice.client
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', alice.id)
    expect(error?.code).toBe('42501') // permission denied for column role
    const { rows } = await db().query(
      'select role from public.profiles where id = $1',
      [alice.id],
    )
    expect(rows[0].role).toBe('user') // unchanged
  })
})

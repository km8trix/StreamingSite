import { beforeEach, describe, expect, it, vi } from 'vitest'
import { __resetRateLimitStore } from '@/lib/rate-limit'
import { RATE_LIMITS } from '@/lib/rate-limit-rules'

// Mock the data-layer impls (the wrappers delegate to these) + next/headers.
// vi.hoisted lets the mock factories reference these without a TDZ.
const impl = vi.hoisted(() => ({
  add: vi.fn(async () => ({}) as { error?: string }),
  edit: vi.fn(async () => ({}) as { error?: string }),
  del: vi.fn(async () => ({}) as { error?: string }),
}))
vi.mock('@/lib/data/comments', () => ({
  addComment: impl.add,
  editComment: impl.edit,
  deleteComment: impl.del,
}))
const h = vi.hoisted(() => ({ value: new Headers() }))
vi.mock('next/headers', () => ({ headers: async () => h.value }))

import { addComment, deleteComment, editComment } from './actions'

const PUBLIC_IP = '203.0.113.20'

beforeEach(() => {
  __resetRateLimitStore()
  h.value = new Headers({ 'x-forwarded-for': PUBLIC_IP })
  impl.add.mockClear()
  impl.edit.mockClear()
  impl.del.mockClear()
})

describe('comment action rate limiting', () => {
  it('delegates to the impl while under the limit', async () => {
    await addComment('show-1', 'hello', null)
    expect(impl.add).toHaveBeenCalledWith('show-1', 'hello', null)
  })

  it('throttles addComment and stops delegating once over the create limit', async () => {
    for (let i = 0; i < RATE_LIMITS.commentCreate.limit; i++) {
      expect(await addComment('show-1', `c${i}`)).toEqual({})
    }
    impl.add.mockClear()
    const blocked = await addComment('show-1', 'one too many')
    expect(blocked.error).toMatch(/too many/i)
    expect(impl.add).not.toHaveBeenCalled() // short-circuited before the data layer
  })

  it('edit + delete share one mutate bucket, separate from create', async () => {
    // The create bucket is independent: exhaust it, edit/delete must still work.
    for (let i = 0; i < RATE_LIMITS.commentCreate.limit; i++) await addComment('s', `c${i}`)
    expect((await addComment('s', 'blocked')).error).toMatch(/too many/i)

    // commentMutate is ONE counter shared by edit + delete. Interleave to the
    // limit, then the next mutate (either op) blocks — proving same bucket + fire.
    const limit = RATE_LIMITS.commentMutate.limit
    for (let i = 0; i < limit; i++) {
      const r = i % 2 === 0 ? await editComment('c1', `e${i}`) : await deleteComment('c1')
      expect(r).toEqual({})
    }
    expect((await editComment('c1', 'over')).error).toMatch(/too many/i)
    expect((await deleteComment('c1')).error).toMatch(/too many/i)
  })
})

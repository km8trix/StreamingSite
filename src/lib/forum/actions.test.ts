import { beforeEach, describe, expect, it, vi } from 'vitest'
import { __resetRateLimitStore } from '@/lib/rate-limit'
import { RATE_LIMITS } from '@/lib/rate-limit-rules'

// Mock the data-layer impls (the wrappers delegate to these) + next/headers.
const impl = vi.hoisted(() => ({
  createThread: vi.fn(async () => ({ threadId: 't1' }) as { error?: string; threadId?: string }),
  replyToThread: vi.fn(async () => ({}) as { error?: string }),
  editPost: vi.fn(async () => ({}) as { error?: string }),
  deletePost: vi.fn(async () => ({}) as { error?: string }),
  pinThread: vi.fn(async () => ({}) as { error?: string }),
  lockThread: vi.fn(async () => ({}) as { error?: string }),
}))
vi.mock('@/lib/data/forum', () => ({
  createThread: impl.createThread,
  replyToThread: impl.replyToThread,
  editPost: impl.editPost,
  deletePost: impl.deletePost,
  pinThread: impl.pinThread,
  lockThread: impl.lockThread,
}))
const h = vi.hoisted(() => ({ value: new Headers() }))
vi.mock('next/headers', () => ({ headers: async () => h.value }))

import { createThread, deletePost, editPost, lockThread, pinThread, replyToThread } from './actions'

const PUBLIC_IP = '203.0.113.30'

beforeEach(() => {
  __resetRateLimitStore()
  h.value = new Headers({ 'x-forwarded-for': PUBLIC_IP })
  for (const fn of Object.values(impl)) fn.mockClear()
})

describe('forum action rate limiting', () => {
  it('delegates to the impl while under the limit', async () => {
    await createThread('cat-1', 'Title', 'Body')
    expect(impl.createThread).toHaveBeenCalledWith('cat-1', 'Title', 'Body')
  })

  it('throttles thread creation and stops delegating once over the limit', async () => {
    for (let i = 0; i < RATE_LIMITS.threadCreate.limit; i++) {
      await createThread('cat-1', `T${i}`, 'body')
    }
    impl.createThread.mockClear()
    const blocked = await createThread('cat-1', 'too many', 'body')
    expect(blocked.error).toMatch(/too many/i)
    expect(impl.createThread).not.toHaveBeenCalled()
  })

  it('replies use their own bucket, independent of thread creation', async () => {
    for (let i = 0; i < RATE_LIMITS.threadCreate.limit + 1; i++) {
      await createThread('cat-1', `T${i}`, 'body') // exhaust + 1 → thread bucket blocked
    }
    expect(await replyToThread('t1', 'a reply')).toEqual({}) // reply bucket is fresh
    expect(impl.replyToThread).toHaveBeenCalledWith('t1', 'a reply')
  })

  it('leaves moderator pin/lock unthrottled (no rate-limit wrapper)', async () => {
    // Drain every content bucket; pin/lock must still pass straight through.
    for (let i = 0; i < RATE_LIMITS.threadCreate.limit + 1; i++) await createThread('c', `T${i}`, 'b')
    expect(await pinThread('t1', true)).toEqual({})
    expect(impl.pinThread).toHaveBeenCalledWith('t1', true)
    expect(await lockThread('t1', true)).toEqual({})
    expect(impl.lockThread).toHaveBeenCalledWith('t1', true)
  })

  it('throttles replyToThread at the postReply limit', async () => {
    for (let i = 0; i < RATE_LIMITS.postReply.limit; i++) {
      expect(await replyToThread('t1', `r${i}`)).toEqual({})
    }
    impl.replyToThread.mockClear()
    const blocked = await replyToThread('t1', 'one too many')
    expect(blocked.error).toMatch(/too many/i)
    expect(impl.replyToThread).not.toHaveBeenCalled()
  })

  it('post edit + delete share one mutate bucket and throttle together', async () => {
    // postMutate is ONE counter shared by editPost + deletePost. Interleave to
    // the limit, then the next mutate (either op) blocks — same bucket + fire.
    const limit = RATE_LIMITS.postMutate.limit
    for (let i = 0; i < limit; i++) {
      const r = i % 2 === 0 ? await editPost('p1', `e${i}`) : await deletePost('p1')
      expect(r).toEqual({})
    }
    expect((await editPost('p1', 'over')).error).toMatch(/too many/i)
    expect((await deletePost('p1')).error).toMatch(/too many/i)
  })
})

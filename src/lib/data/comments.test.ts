import { beforeEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// M3 Feature 2 (COMMENTS) — data-layer unit tests.
//
// Exercises src/lib/data/comments.ts with the Supabase server client,
// isSupabaseConfigured(), next/cache, and getCurrentUser() all MOCKED, so no
// live database / cookies / Next runtime is needed. We assert:
//
//   READ — getComments():
//     - returns [] when Supabase isn't configured (never builds a client),
//     - builds the THREADED shape (top-level newest-first; replies oldest-first),
//     - joins the author profile (username/displayName/avatarUrl),
//     - BLANKS the body of a soft-deleted comment to '' (isDeleted=true), so the
//       original text never leaves the data layer,
//     - never leaks raw snake_case row keys onto the domain object,
//     - drops orphan replies whose parent isn't a fetched top-level comment,
//     - queries scoped to the show id and ordered created_at ascending.
//
//   WRITE — addComment / editComment / deleteComment (Server Actions):
//     - require a session (return { error } when signed out, before any DB call),
//     - take user_id SERVER-SIDE from the session (auth.uid()), NEVER from the
//       client — the insert payload's user_id is always the session user,
//     - validate the body (empty / whitespace-only / >4000 rejected pre-DB),
//     - editComment sets is_edited=true and scopes by id AND user_id,
//     - deleteComment is a SOFT delete (is_deleted=true, body blanked) scoped to
//       the owner,
//     - map a zero-row update (wrong owner) to a "not yours" error,
//     - surface a Supabase error.message onto { error },
//     - never leak secrets — only { error?: string } is ever returned.
// ---------------------------------------------------------------------------

// Mock the config gate so isSupabaseConfigured() is controllable per-test.
const isConfiguredMock = vi.fn(() => true)
vi.mock('@/lib/supabase/config', () => ({
  isSupabaseConfigured: () => isConfiguredMock(),
}))

// Mock next/cache so revalidatePath() is an observable no-op.
const revalidatePath = vi.fn()
vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => revalidatePath(...args),
}))

// getCurrentUser() (imported by the actions from ./profiles) — controllable.
const getCurrentUserMock = vi.fn()
vi.mock('./profiles', () => ({
  getCurrentUser: () => getCurrentUserMock(),
}))

// ---------------------------------------------------------------------------
// Fake Supabase client.
//
// The comments module issues these chains:
//   getComments:  from('comments').select(cols).eq('show_id', x).order('created_at',{ascending}) -> {data,error}
//   addComment:   from('comments').insert(payload) -> {error}
//                 from('shows').select('slug').eq('id', x).maybeSingle() -> {data,error}   (revalidate)
//   edit/delete:  from('comments').update(payload).eq('id', x).eq('user_id', y).select('show_id').maybeSingle() -> {data,error}
//                 from('shows').select('slug').eq('id', x).maybeSingle() -> {data,error}   (revalidate)
//
// The builder is a thenable-returning chain. `.order()` and `.maybeSingle()` are
// the terminal awaitables; `.insert()` is itself awaitable.
// ---------------------------------------------------------------------------

type Resp = { data?: unknown; error?: unknown }

let installed: {
  commentsSelect?: Resp // getComments terminal (.order)
  insert?: Resp // addComment terminal (.insert)
  commentsUpdate?: Resp // edit/delete terminal (.maybeSingle)
  parentLookup?: Resp // addComment parent validation (.maybeSingle on comments)
  showsSlug?: Resp // revalidate lookup (.maybeSingle on shows)
} = {}

// addComment validates a reply's parent with a `from('comments').select(...).eq
// ('id',..).maybeSingle()` BEFORE the insert, while edit/delete use
// `.update(...).maybeSingle()`. Both terminate on the comments builder's
// .maybeSingle(), so we route by whether .update() was called on this builder:
// an update means it's the edit/delete path (commentsUpdate); otherwise it's the
// parent lookup (parentLookup, defaulting to a valid same-show top-level parent).

const calls = {
  from: [] as string[],
  select: [] as string[],
  eq: [] as Array<[string, unknown]>,
  order: [] as Array<[string, unknown]>,
  inserts: [] as unknown[],
  updates: [] as unknown[],
}

function makeFakeClient() {
  function commentsBuilder() {
    let didUpdate = false
    const builder: Record<string, unknown> = {}
    builder.select = (cols: string) => {
      calls.select.push(cols)
      return builder
    }
    builder.eq = (col: string, val: unknown) => {
      calls.eq.push([col, val])
      return builder
    }
    builder.order = async (col: string, opts: unknown) => {
      calls.order.push([col, opts])
      return installed.commentsSelect ?? { data: [], error: null }
    }
    builder.insert = async (payload: unknown) => {
      calls.inserts.push(payload)
      return installed.insert ?? { error: null }
    }
    builder.update = (payload: unknown) => {
      didUpdate = true
      calls.updates.push(payload)
      return builder
    }
    builder.maybeSingle = async () => {
      if (didUpdate) {
        // edit / delete terminal
        return installed.commentsUpdate ?? { data: null, error: null }
      }
      // addComment's parent validation — default to a valid same-show top-level
      // parent so legit reply tests don't have to wire it up every time.
      return (
        installed.parentLookup ?? {
          data: { id: 'parent-123', parent_id: null, show_id: 'show-001' },
          error: null,
        }
      )
    }
    return builder
  }

  function showsBuilder() {
    const builder: Record<string, unknown> = {}
    builder.select = (cols: string) => {
      calls.select.push(cols)
      return builder
    }
    builder.eq = (col: string, val: unknown) => {
      calls.eq.push([col, val])
      return builder
    }
    builder.maybeSingle = async () =>
      installed.showsSlug ?? { data: { slug: 'a-show' }, error: null }
    return builder
  }

  return {
    from(table: string) {
      calls.from.push(table)
      return table === 'shows' ? showsBuilder() : commentsBuilder()
    },
  }
}

const getServerClientMock = vi.fn(async () => makeFakeClient())
vi.mock('@/lib/supabase/server', () => ({
  getServerClient: () => getServerClientMock(),
}))

import {
  addComment,
  deleteComment,
  editComment,
  getComments,
} from '@/lib/data/comments'

// A raw comment row as PostgREST returns it (snake_case + aliased author embed).
function rawRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'c-top-1',
    show_id: 'show-001',
    user_id: 'user-A',
    parent_id: null,
    body: 'Top level comment',
    is_edited: false,
    is_deleted: false,
    created_at: '2026-06-10T10:00:00.000Z',
    updated_at: '2026-06-10T10:00:00.000Z',
    author: {
      username: 'alice',
      display_name: 'Alice',
      avatar_url: 'https://cdn.example.com/a.png',
    },
    ...overrides,
  }
}

const signedIn = {
  userId: 'user-A',
  email: 'a@b.com',
  profile: null,
}

beforeEach(() => {
  isConfiguredMock.mockReturnValue(true)
  installed = {}
  calls.from = []
  calls.select = []
  calls.eq = []
  calls.order = []
  calls.inserts = []
  calls.updates = []
  revalidatePath.mockClear()
  getCurrentUserMock.mockReset()
  getServerClientMock.mockClear()
})

// ===========================================================================
// getComments — read / mapper / threading
// ===========================================================================

describe('getComments', () => {
  it('returns [] when Supabase is not configured (never builds a client)', async () => {
    isConfiguredMock.mockReturnValue(false)
    expect(await getComments('show-001')).toEqual([])
    expect(getServerClientMock).not.toHaveBeenCalled()
  })

  it('queries comments scoped to the show id, ordered created_at ascending', async () => {
    installed.commentsSelect = { data: [rawRow()], error: null }
    await getComments('show-042')
    expect(calls.from).toContain('comments')
    expect(calls.eq).toContainEqual(['show_id', 'show-042'])
    expect(calls.order).toContainEqual(['created_at', { ascending: true }])
  })

  it('maps a row to the camelCase domain Comment with author join', async () => {
    installed.commentsSelect = { data: [rawRow()], error: null }
    const threads = await getComments('show-001')
    expect(threads).toHaveLength(1)
    expect(threads[0]).toMatchObject({
      id: 'c-top-1',
      showId: 'show-001',
      userId: 'user-A',
      parentId: null,
      body: 'Top level comment',
      isEdited: false,
      isDeleted: false,
      author: {
        username: 'alice',
        displayName: 'Alice',
        avatarUrl: 'https://cdn.example.com/a.png',
      },
      replies: [],
    })
  })

  it('never leaks raw snake_case row keys onto the domain object', async () => {
    installed.commentsSelect = { data: [rawRow()], error: null }
    const [thread] = await getComments('show-001')
    expect(thread).not.toHaveProperty('show_id')
    expect(thread).not.toHaveProperty('user_id')
    expect(thread).not.toHaveProperty('parent_id')
    expect(thread).not.toHaveProperty('is_edited')
    expect(thread).not.toHaveProperty('is_deleted')
    expect(thread).not.toHaveProperty('created_at')
    expect(thread.author).not.toHaveProperty('display_name')
    expect(thread.author).not.toHaveProperty('avatar_url')
  })

  it('normalizes an array-shaped author embed to a single author', async () => {
    // PostgREST sometimes returns a to-one embed as a 1-element array.
    installed.commentsSelect = {
      data: [
        rawRow({
          author: [
            { username: 'bob', display_name: 'Bob', avatar_url: null },
          ],
        }),
      ],
      error: null,
    }
    const [thread] = await getComments('show-001')
    expect(thread.author).toEqual({
      username: 'bob',
      displayName: 'Bob',
      avatarUrl: null,
    })
  })

  it('tolerates a null author embed (orphaned profile) with all-null author', async () => {
    installed.commentsSelect = {
      data: [rawRow({ author: null })],
      error: null,
    }
    const [thread] = await getComments('show-001')
    expect(thread.author).toEqual({
      username: null,
      displayName: null,
      avatarUrl: null,
    })
  })

  it('BLANKS the body of a soft-deleted comment (original text never leaks)', async () => {
    installed.commentsSelect = {
      data: [
        rawRow({
          is_deleted: true,
          body: 'this should never reach the caller',
        }),
      ],
      error: null,
    }
    const [thread] = await getComments('show-001')
    expect(thread.isDeleted).toBe(true)
    expect(thread.body).toBe('')
    expect(JSON.stringify(thread)).not.toContain('never reach')
  })

  it('orders top-level comments NEWEST first (reverses the asc fetch)', async () => {
    // Fetched ascending (oldest-first): older then newer.
    installed.commentsSelect = {
      data: [
        rawRow({ id: 'older', created_at: '2026-06-01T00:00:00.000Z' }),
        rawRow({ id: 'newer', created_at: '2026-06-09T00:00:00.000Z' }),
      ],
      error: null,
    }
    const threads = await getComments('show-001')
    expect(threads.map((t) => t.id)).toEqual(['newer', 'older'])
  })

  it('nests replies under their parent, OLDEST first, and not at top level', async () => {
    installed.commentsSelect = {
      data: [
        rawRow({ id: 'top', parent_id: null, created_at: '2026-06-01T00:00:00.000Z' }),
        rawRow({ id: 'r1', parent_id: 'top', created_at: '2026-06-02T00:00:00.000Z' }),
        rawRow({ id: 'r2', parent_id: 'top', created_at: '2026-06-03T00:00:00.000Z' }),
      ],
      error: null,
    }
    const threads = await getComments('show-001')
    // One top-level thread; replies are NOT promoted to top level.
    expect(threads).toHaveLength(1)
    expect(threads[0].id).toBe('top')
    // Replies oldest-first (asc fetch order preserved).
    expect(threads[0].replies.map((r) => r.id)).toEqual(['r1', 'r2'])
  })

  it('drops an orphan reply whose parent is not a fetched top-level comment', async () => {
    installed.commentsSelect = {
      data: [
        rawRow({ id: 'top', parent_id: null }),
        rawRow({ id: 'orphan', parent_id: 'missing-parent' }),
      ],
      error: null,
    }
    const threads = await getComments('show-001')
    expect(threads).toHaveLength(1)
    expect(threads[0].id).toBe('top')
    expect(threads[0].replies).toEqual([])
  })

  it('keeps a soft-deleted parent in the thread so its replies stay visible', async () => {
    installed.commentsSelect = {
      data: [
        rawRow({ id: 'top', parent_id: null, is_deleted: true, body: 'gone' }),
        rawRow({ id: 'r1', parent_id: 'top', body: 'still here' }),
      ],
      error: null,
    }
    const threads = await getComments('show-001')
    expect(threads).toHaveLength(1)
    expect(threads[0].isDeleted).toBe(true)
    expect(threads[0].body).toBe('')
    expect(threads[0].replies).toHaveLength(1)
    expect(threads[0].replies[0].body).toBe('still here')
  })

  it('returns [] for an empty result set', async () => {
    installed.commentsSelect = { data: [], error: null }
    expect(await getComments('show-001')).toEqual([])
  })

  it('throws when the comments query errors', async () => {
    installed.commentsSelect = { data: null, error: { message: 'boom' } }
    await expect(getComments('show-001')).rejects.toMatchObject({
      message: 'boom',
    })
  })
})

// ===========================================================================
// addComment — auth, server-side user_id, validation
// ===========================================================================

describe('addComment', () => {
  it('requires a session — returns an error and never touches the DB when signed out', async () => {
    getCurrentUserMock.mockResolvedValue(null)
    const result = await addComment('show-001', 'hello')
    expect(result).toEqual({ error: 'You must be signed in to comment.' })
    expect(getServerClientMock).not.toHaveBeenCalled()
    expect(calls.inserts).toHaveLength(0)
  })

  it('rejects an empty body before any DB call', async () => {
    getCurrentUserMock.mockResolvedValue(signedIn)
    const result = await addComment('show-001', '')
    expect(result).toEqual({ error: 'Comment cannot be empty.' })
    expect(getServerClientMock).not.toHaveBeenCalled()
  })

  it('rejects a whitespace-only body (trimmed to empty)', async () => {
    getCurrentUserMock.mockResolvedValue(signedIn)
    const result = await addComment('show-001', '   \n\t  ')
    expect(result).toEqual({ error: 'Comment cannot be empty.' })
    expect(getServerClientMock).not.toHaveBeenCalled()
  })

  it('rejects a body longer than 4000 characters', async () => {
    getCurrentUserMock.mockResolvedValue(signedIn)
    const result = await addComment('show-001', 'x'.repeat(4001))
    expect(result).toMatchObject({
      error: expect.stringContaining('4000 characters'),
    })
    expect(getServerClientMock).not.toHaveBeenCalled()
  })

  it('accepts a body of exactly 4000 characters (boundary)', async () => {
    getCurrentUserMock.mockResolvedValue(signedIn)
    const result = await addComment('show-001', 'y'.repeat(4000))
    expect(result).toEqual({})
    expect(calls.inserts).toHaveLength(1)
  })

  it('sets user_id SERVER-SIDE from the session, NEVER from the client', async () => {
    getCurrentUserMock.mockResolvedValue({ ...signedIn, userId: 'session-user' })
    await addComment('show-001', 'hi')
    expect(calls.inserts[0]).toMatchObject({
      show_id: 'show-001',
      user_id: 'session-user', // from the validated session
      parent_id: null,
      body: 'hi',
    })
  })

  it('trims the stored body', async () => {
    getCurrentUserMock.mockResolvedValue(signedIn)
    await addComment('show-001', '  padded  ')
    expect((calls.inserts[0] as { body: string }).body).toBe('padded')
  })

  it('passes parentId through for a reply, defaulting to null when omitted', async () => {
    getCurrentUserMock.mockResolvedValue(signedIn)
    await addComment('show-001', 'reply', 'parent-123')
    expect((calls.inserts[0] as { parent_id: unknown }).parent_id).toBe('parent-123')

    calls.inserts.length = 0
    await addComment('show-001', 'top')
    expect((calls.inserts[0] as { parent_id: unknown }).parent_id).toBeNull()
  })

  it('revalidates the show detail page on success', async () => {
    getCurrentUserMock.mockResolvedValue(signedIn)
    installed.showsSlug = { data: { slug: 'frieren' }, error: null }
    const result = await addComment('show-001', 'hi')
    expect(result).toEqual({})
    expect(revalidatePath).toHaveBeenCalledWith('/shows/frieren')
  })

  it('validates a reply parent: rejects a non-existent parent (no insert)', async () => {
    getCurrentUserMock.mockResolvedValue(signedIn)
    installed.parentLookup = { data: null, error: null } // parent not found
    const result = await addComment('show-001', 'reply', 'ghost-parent')
    expect(result).toEqual({
      error: 'You can only reply to a top-level comment on this show.',
    })
    expect(calls.inserts).toHaveLength(0)
  })

  it('validates a reply parent: rejects replying to a reply (depth-2)', async () => {
    getCurrentUserMock.mockResolvedValue(signedIn)
    installed.parentLookup = {
      data: { id: 'r1', parent_id: 'top', show_id: 'show-001' }, // parent is itself a reply
      error: null,
    }
    const result = await addComment('show-001', 'reply', 'r1')
    expect(result).toEqual({
      error: 'You can only reply to a top-level comment on this show.',
    })
    expect(calls.inserts).toHaveLength(0)
  })

  it('validates a reply parent: rejects a parent from another show', async () => {
    getCurrentUserMock.mockResolvedValue(signedIn)
    installed.parentLookup = {
      data: { id: 'p', parent_id: null, show_id: 'show-999' }, // different show
      error: null,
    }
    const result = await addComment('show-001', 'reply', 'p')
    expect(result).toEqual({
      error: 'You can only reply to a top-level comment on this show.',
    })
    expect(calls.inserts).toHaveLength(0)
  })

  it('accepts a reply to a valid same-show top-level parent', async () => {
    getCurrentUserMock.mockResolvedValue(signedIn)
    installed.parentLookup = {
      data: { id: 'top-1', parent_id: null, show_id: 'show-001' },
      error: null,
    }
    const result = await addComment('show-001', 'reply', 'top-1')
    expect(result).toEqual({})
    expect((calls.inserts[0] as { parent_id: unknown }).parent_id).toBe('top-1')
  })

  it('surfaces a Supabase insert error onto { error } (e.g. RLS spoof rejection)', async () => {
    getCurrentUserMock.mockResolvedValue(signedIn)
    installed.insert = {
      error: { message: 'new row violates row-level security policy' },
    }
    const result = await addComment('show-001', 'hi')
    expect(result).toEqual({
      error: 'new row violates row-level security policy',
    })
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('does not leak the body or session details back to the caller on success', async () => {
    getCurrentUserMock.mockResolvedValue(signedIn)
    const result = await addComment('show-001', 'secret content')
    expect(result).toEqual({})
  })
})

// ===========================================================================
// editComment — auth, owner-scope, is_edited, validation
// ===========================================================================

describe('editComment', () => {
  it('requires a session', async () => {
    getCurrentUserMock.mockResolvedValue(null)
    const result = await editComment('c-1', 'new body')
    expect(result).toEqual({
      error: 'You must be signed in to edit a comment.',
    })
    expect(getServerClientMock).not.toHaveBeenCalled()
  })

  it('rejects an empty body before any DB call', async () => {
    getCurrentUserMock.mockResolvedValue(signedIn)
    const result = await editComment('c-1', '   ')
    expect(result).toEqual({ error: 'Comment cannot be empty.' })
    expect(getServerClientMock).not.toHaveBeenCalled()
  })

  it('rejects a body longer than 4000 characters', async () => {
    getCurrentUserMock.mockResolvedValue(signedIn)
    const result = await editComment('c-1', 'x'.repeat(4001))
    expect(result).toMatchObject({
      error: expect.stringContaining('4000 characters'),
    })
    expect(getServerClientMock).not.toHaveBeenCalled()
  })

  it('sets is_edited=true and scopes the update by id AND the owner', async () => {
    getCurrentUserMock.mockResolvedValue({ ...signedIn, userId: 'owner-1' })
    installed.commentsUpdate = { data: { show_id: 'show-001' }, error: null }
    const result = await editComment('c-9', 'updated')
    expect(result).toEqual({})
    expect(calls.updates[0]).toEqual({ body: 'updated', is_edited: true })
    expect(calls.eq).toContainEqual(['id', 'c-9'])
    expect(calls.eq).toContainEqual(['user_id', 'owner-1'])
  })

  it('guards against editing a deleted comment: scopes the update by is_deleted=false', async () => {
    // Defense-in-depth for the content-integrity ratchet — an edit must never
    // revive a soft-deleted comment, so the query excludes deleted rows. The DB
    // trigger is authoritative, but this keeps the action from claiming success
    // on a row it cannot revive.
    getCurrentUserMock.mockResolvedValue(signedIn)
    installed.commentsUpdate = { data: { show_id: 'show-001' }, error: null }
    await editComment('c-9', 'updated')
    expect(calls.eq).toContainEqual(['is_deleted', false])
  })

  it('does NOT write user_id / show_id / parent_id (no ownership tampering via edit)', async () => {
    getCurrentUserMock.mockResolvedValue(signedIn)
    installed.commentsUpdate = { data: { show_id: 'show-001' }, error: null }
    await editComment('c-9', 'updated')
    const payload = calls.updates[0] as Record<string, unknown>
    expect(payload).not.toHaveProperty('user_id')
    expect(payload).not.toHaveProperty('show_id')
    expect(payload).not.toHaveProperty('parent_id')
    expect(payload).not.toHaveProperty('is_deleted')
  })

  it('maps a zero-row update (wrong owner / missing) to a "not yours" error', async () => {
    getCurrentUserMock.mockResolvedValue(signedIn)
    installed.commentsUpdate = { data: null, error: null } // RLS/owner filter matched nothing
    const result = await editComment('someone-elses', 'hax')
    expect(result).toEqual({
      error: 'Comment not found or not yours to edit.',
    })
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('surfaces a Supabase update error onto { error }', async () => {
    getCurrentUserMock.mockResolvedValue(signedIn)
    installed.commentsUpdate = {
      data: null,
      error: { message: 'permission denied for column user_id' },
    }
    const result = await editComment('c-1', 'x')
    expect(result).toEqual({
      error: 'permission denied for column user_id',
    })
  })

  it('revalidates the show page (looked up from the returned show_id) on success', async () => {
    getCurrentUserMock.mockResolvedValue(signedIn)
    installed.commentsUpdate = { data: { show_id: 'show-007' }, error: null }
    installed.showsSlug = { data: { slug: 'cowboy-bebop' }, error: null }
    await editComment('c-1', 'edited')
    expect(calls.eq).toContainEqual(['id', 'show-007'])
    expect(revalidatePath).toHaveBeenCalledWith('/shows/cowboy-bebop')
  })
})

// ===========================================================================
// deleteComment — auth, SOFT delete, owner-scope
// ===========================================================================

describe('deleteComment', () => {
  it('requires a session', async () => {
    getCurrentUserMock.mockResolvedValue(null)
    const result = await deleteComment('c-1')
    expect(result).toEqual({
      error: 'You must be signed in to delete a comment.',
    })
    expect(getServerClientMock).not.toHaveBeenCalled()
  })

  it('SOFT-deletes: sets is_deleted=true and BLANKS the body to "" (no row DELETE)', async () => {
    getCurrentUserMock.mockResolvedValue({ ...signedIn, userId: 'owner-1' })
    installed.commentsUpdate = { data: { show_id: 'show-001' }, error: null }
    const result = await deleteComment('c-9')
    expect(result).toEqual({})
    const payload = calls.updates[0] as Record<string, unknown>
    expect(payload.is_deleted).toBe(true)
    // Body is erased at rest (the trigger keeps it '' on any later update).
    expect(payload.body).toBe('')
    // Scoped to the owner's own row.
    expect(calls.eq).toContainEqual(['id', 'c-9'])
    expect(calls.eq).toContainEqual(['user_id', 'owner-1'])
  })

  it('does not write user_id / show_id / parent_id during a delete', async () => {
    getCurrentUserMock.mockResolvedValue(signedIn)
    installed.commentsUpdate = { data: { show_id: 'show-001' }, error: null }
    await deleteComment('c-9')
    const payload = calls.updates[0] as Record<string, unknown>
    expect(payload).not.toHaveProperty('user_id')
    expect(payload).not.toHaveProperty('show_id')
    expect(payload).not.toHaveProperty('parent_id')
  })

  it('maps a zero-row update (not your comment) to a "not yours" error', async () => {
    getCurrentUserMock.mockResolvedValue(signedIn)
    installed.commentsUpdate = { data: null, error: null }
    const result = await deleteComment('someone-elses')
    expect(result).toEqual({
      error: 'Comment not found or not yours to delete.',
    })
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('surfaces a Supabase error onto { error }', async () => {
    getCurrentUserMock.mockResolvedValue(signedIn)
    installed.commentsUpdate = {
      data: null,
      error: { message: 'db down' },
    }
    const result = await deleteComment('c-1')
    expect(result).toEqual({ error: 'db down' })
  })

  it('revalidates the show page on success', async () => {
    getCurrentUserMock.mockResolvedValue(signedIn)
    installed.commentsUpdate = { data: { show_id: 'show-001' }, error: null }
    installed.showsSlug = { data: { slug: 'naruto' }, error: null }
    await deleteComment('c-1')
    expect(revalidatePath).toHaveBeenCalledWith('/shows/naruto')
  })
})

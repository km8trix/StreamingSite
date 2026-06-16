import { beforeEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// M3 Feature 3 (FORUM) — data-layer unit tests.
//
// Exercises src/lib/data/forum.ts with the Supabase server client,
// isSupabaseConfigured(), next/cache, and getCurrentUser() all MOCKED, so no
// live database / cookies / Next runtime is needed. We assert:
//
//   READ:
//     - listCategories / getCategory / listThreads / getThread return [] / null
//       when Supabase isn't configured (never build a client),
//     - row -> camelCase domain mapping for every shape (category/thread/post),
//     - author profile join normalized (object OR 1-element array OR null),
//     - postCount derived from the embedded forum_posts(count) aggregate,
//     - listThreads orders PINNED-FIRST then last_activity_at desc, and filters
//       the post-count embed to live (non-deleted) posts,
//     - getThread accepts a uuid id OR a slug (correct .eq column each way),
//       returns posts oldest-first, and BLANKS a soft-deleted post body to ''
//       (the original text never leaves the data layer),
//     - raw snake_case row keys never leak onto the domain object.
//
//   WRITE — createThread / replyToThread / editPost / deletePost / pinThread /
//   lockThread (Server Actions):
//     - require a session (return { error } when signed out, before any DB call),
//     - take user_id SERVER-SIDE from the session (auth.uid()), NEVER the client,
//     - validate title/body (empty / whitespace / over-length rejected pre-DB),
//     - createThread creates the thread AND its first post, and rolls back the
//       orphan thread if the post insert fails,
//     - replyToThread rejects a LOCKED thread for a non-moderator at the action
//       level (a moderator is allowed through),
//     - editPost scopes by id AND owner AND is_deleted=false, sets is_edited,
//       and never writes ownership/system columns,
//     - deletePost SOFT-deletes (is_deleted=true, body blanked) WITHOUT scoping
//       by user_id (so RLS's own-or-mod gate can let a mod delete any post),
//     - pinThread / lockThread pre-check the caller's profile role and reject a
//       non-moderator before any DB write,
//     - Supabase errors are surfaced onto { error }; only { error?, threadId? }
//       is ever returned (no secrets / row internals leak).
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
// Each from(table) returns a fresh chainable builder. We record every call and
// route the terminal awaitable by:
//   - which TABLE the builder is for,
//   - whether .insert() / .update() / .delete() was invoked on it,
//   - which terminal was used (.order / .single / .maybeSingle / awaited insert).
// The chains forum.ts issues:
//   listCategories:  forum_categories .select .order                 -> {data,error}
//   getCategory:     forum_categories .select .eq .maybeSingle       -> {data,error}
//   listThreads:     forum_threads .select .eq .eq .order .order     -> {data,error}
//   getThread(read): forum_threads .select .eq .maybeSingle          -> {data,error}
//                    forum_posts .select .eq .order                  -> {data,error}
//   createThread:    forum_categories .select .eq .maybeSingle       -> {data,error}
//                    forum_threads .insert .select .single           -> {data,error}
//                    forum_posts .insert (awaited)                   -> {error}
//                    forum_threads .delete .eq (rollback, awaited)   -> {error}
//   replyToThread:   forum_threads .select .eq .maybeSingle          -> {data,error}
//                    forum_posts .insert (awaited)                   -> {error}
//   editPost:        forum_posts .update .eq .eq .eq .select .maybeSingle
//   deletePost:      forum_posts .update .eq .select .maybeSingle
//   pinThread:       forum_threads .update .eq .select .maybeSingle
//   lockThread:      forum_threads .update .eq .select .maybeSingle
// ---------------------------------------------------------------------------

type Resp = { data?: unknown; error?: unknown }

let installed: {
  categoriesList?: Resp // listCategories terminal (.order on forum_categories)
  categoryLookup?: Resp // getCategory / createThread category check (.maybeSingle on forum_categories)
  threadsList?: Resp // listThreads terminal (.order on forum_threads, no insert/update)
  threadLookup?: Resp // getThread / replyToThread thread read (.maybeSingle on forum_threads, no insert/update)
  postsList?: Resp // getThread posts terminal (.order on forum_posts, no insert/update)
  threadInsert?: Resp // createThread thread insert (.single on forum_threads after .insert)
  postInsert?: Resp // createThread/replyToThread post insert (awaited forum_posts .insert)
  threadUpdate?: Resp // pin/lock terminal (.maybeSingle on forum_threads after .update)
  postUpdate?: Resp // edit/delete terminal (.maybeSingle on forum_posts after .update)
  threadDelete?: Resp // createThread rollback (awaited forum_threads .delete)
} = {}

const calls = {
  from: [] as string[],
  select: [] as string[],
  eq: [] as Array<[string, unknown]>,
  order: [] as Array<[string, unknown]>,
  threadInserts: [] as unknown[],
  postInserts: [] as unknown[],
  threadUpdates: [] as unknown[],
  postUpdates: [] as unknown[],
  threadDeletes: 0,
}

function makeFakeClient() {
  function builderFor(table: string) {
    let didInsert = false
    let didUpdate = false
    let didDelete = false
    const builder: Record<string, unknown> = {}

    builder.select = (cols: string) => {
      calls.select.push(cols)
      return builder
    }
    builder.eq = (col: string, val: unknown) => {
      calls.eq.push([col, val])
      // forum_threads .delete().eq(...) is awaited directly (rollback path); make
      // the post-delete eq() chain itself awaitable for that case.
      return builder
    }
    // listThreads chains .order().order(); listCategories and getThread's posts
    // query use a single .order(). So .order() returns the (thenable) builder —
    // chainable AND awaitable. When awaited it resolves to the table-appropriate
    // list response (so single- or multi-order chains both terminate correctly).
    builder.order = (col: string, opts: unknown) => {
      calls.order.push([col, opts])
      builder.then = (resolve: (v: Resp) => unknown) => {
        if (table === 'forum_categories') {
          return resolve(installed.categoriesList ?? { data: [], error: null })
        }
        if (table === 'forum_posts') {
          return resolve(installed.postsList ?? { data: [], error: null })
        }
        return resolve(installed.threadsList ?? { data: [], error: null })
      }
      return builder
    }
    // .limit(n) is a passthrough used by getThread's slug branch (order+limit+
    // maybeSingle, robust against a duplicate slug) and by uniqueThreadSlug's
    // existence probe (select.eq.limit.maybeSingle). It's chainable AND, like
    // .order(), awaitable as a list — so awaiting after .limit() still resolves
    // the table-appropriate list response.
    builder.limit = (n: number) => {
      void n
      builder.then = (resolve: (v: Resp) => unknown) => {
        if (table === 'forum_categories') {
          return resolve(installed.categoriesList ?? { data: [], error: null })
        }
        if (table === 'forum_posts') {
          return resolve(installed.postsList ?? { data: [], error: null })
        }
        return resolve(installed.threadsList ?? { data: [], error: null })
      }
      return builder
    }
    builder.insert = (payload: unknown) => {
      didInsert = true
      if (table === 'forum_threads') calls.threadInserts.push(payload)
      else calls.postInserts.push(payload)
      // forum_posts insert is awaited directly (no .select); make the builder a
      // thenable so `await supabase.from('forum_posts').insert(...)` resolves.
      builder.then = (resolve: (v: Resp) => unknown) =>
        resolve(
          table === 'forum_threads'
            ? (installed.threadInsert ?? { data: { id: 'new-thread' }, error: null })
            : (installed.postInsert ?? { error: null }),
        )
      return builder
    }
    builder.update = (payload: unknown) => {
      didUpdate = true
      if (table === 'forum_threads') calls.threadUpdates.push(payload)
      else calls.postUpdates.push(payload)
      return builder
    }
    builder.delete = () => {
      didDelete = true
      // forum_threads .delete().eq('id', …) is awaited; make the builder thenable.
      builder.then = (resolve: (v: Resp) => unknown) => {
        calls.threadDeletes += 1
        return resolve(installed.threadDelete ?? { error: null })
      }
      return builder
    }
    builder.single = async () => {
      // createThread thread insert terminal.
      return installed.threadInsert ?? { data: { id: 'new-thread' }, error: null }
    }
    builder.maybeSingle = async () => {
      if (table === 'forum_categories') {
        return (
          installed.categoryLookup ?? {
            data: { id: 'cat-general', slug: 'general-discussion' },
            error: null,
          }
        )
      }
      if (table === 'forum_threads') {
        if (didUpdate) return installed.threadUpdate ?? { data: null, error: null }
        // thread read (getThread / replyToThread)
        return installed.threadLookup ?? { data: null, error: null }
      }
      // forum_posts
      if (didUpdate) return installed.postUpdate ?? { data: null, error: null }
      return { data: null, error: null }
    }

    // Silence unused-var lint for the delete flag (it's only meaningful via .then).
    void didInsert
    void didDelete
    return builder
  }

  return {
    from(table: string) {
      calls.from.push(table)
      return builderFor(table)
    },
  }
}

const getServerClientMock = vi.fn(async () => makeFakeClient())
vi.mock('@/lib/supabase/server', () => ({
  getServerClient: () => getServerClientMock(),
}))

import {
  createThread,
  deletePost,
  editPost,
  getCategory,
  getThread,
  listCategories,
  listThreads,
  lockThread,
  pinThread,
  replyToThread,
} from '@/lib/data/forum'

// ---------------------------------------------------------------------------
// Raw row fixtures (PostgREST snake_case + aliased embeds)
// ---------------------------------------------------------------------------

function rawCategory(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cat-general',
    name: 'General Discussion',
    slug: 'general-discussion',
    description: 'Anything anime.',
    sort_order: 1,
    ...overrides,
  }
}

function rawThread(overrides: Record<string, unknown> = {}) {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    category_id: 'cat-general',
    user_id: 'user-A',
    title: 'A thread',
    slug: 'a-thread',
    is_pinned: false,
    is_locked: false,
    show_id: null,
    created_at: '2026-06-10T10:00:00.000Z',
    last_activity_at: '2026-06-10T10:00:00.000Z',
    author: {
      username: 'alice',
      display_name: 'Alice',
      avatar_url: 'https://cdn.example.com/a.png',
    },
    post_count: [{ count: 3 }],
    ...overrides,
  }
}

function rawPost(overrides: Record<string, unknown> = {}) {
  return {
    id: 'post-1',
    thread_id: '11111111-1111-1111-1111-111111111111',
    user_id: 'user-A',
    body: 'First post body',
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

const signedIn = { userId: 'user-A', email: 'a@b.com', profile: null }
const signedInMod = {
  userId: 'mod-1',
  email: 'mod@b.com',
  profile: {
    id: 'mod-1',
    username: 'mod',
    displayName: 'Mod',
    avatarUrl: null,
    role: 'moderator' as const,
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
  },
}

beforeEach(() => {
  isConfiguredMock.mockReturnValue(true)
  installed = {}
  calls.from = []
  calls.select = []
  calls.eq = []
  calls.order = []
  calls.threadInserts = []
  calls.postInserts = []
  calls.threadUpdates = []
  calls.postUpdates = []
  calls.threadDeletes = 0
  revalidatePath.mockClear()
  getCurrentUserMock.mockReset()
  getServerClientMock.mockClear()
})

// ===========================================================================
// listCategories
// ===========================================================================

describe('listCategories', () => {
  it('returns [] when Supabase is not configured (never builds a client)', async () => {
    isConfiguredMock.mockReturnValue(false)
    expect(await listCategories()).toEqual([])
    expect(getServerClientMock).not.toHaveBeenCalled()
  })

  it('queries forum_categories ordered by sort_order ascending', async () => {
    installed.categoriesList = { data: [rawCategory()], error: null }
    await listCategories()
    expect(calls.from).toContain('forum_categories')
    expect(calls.order).toContainEqual(['sort_order', { ascending: true }])
  })

  it('maps rows to the camelCase domain ForumCategory', async () => {
    installed.categoriesList = {
      data: [
        rawCategory(),
        rawCategory({ id: 'cat-feedback', slug: 'site-feedback', sort_order: 4 }),
      ],
      error: null,
    }
    const cats = await listCategories()
    expect(cats).toHaveLength(2)
    expect(cats[0]).toEqual({
      id: 'cat-general',
      name: 'General Discussion',
      slug: 'general-discussion',
      description: 'Anything anime.',
      sortOrder: 1,
    })
  })

  it('never leaks raw snake_case keys (sort_order)', async () => {
    installed.categoriesList = { data: [rawCategory()], error: null }
    const [cat] = await listCategories()
    expect(cat).not.toHaveProperty('sort_order')
  })

  it('falls back to [] when the query errors (build resilience)', async () => {
    // Build resilience (Vercel): forum reads have no seed and MUST NOT throw —
    // a fresh / unmigrated (PGRST205) / unreachable cloud DB legitimately yields
    // no categories. The error degrades to [] (the unconfigured value) instead of
    // crashing the render/build.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    installed.categoriesList = { data: null, error: { message: 'boom' } }
    expect(await listCategories()).toEqual([])
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})

// ===========================================================================
// getCategory
// ===========================================================================

describe('getCategory', () => {
  it('returns null when Supabase is not configured', async () => {
    isConfiguredMock.mockReturnValue(false)
    expect(await getCategory('general-discussion')).toBeNull()
    expect(getServerClientMock).not.toHaveBeenCalled()
  })

  it('queries by slug and maps the row', async () => {
    installed.categoryLookup = { data: rawCategory(), error: null }
    const cat = await getCategory('general-discussion')
    expect(calls.from).toContain('forum_categories')
    expect(calls.eq).toContainEqual(['slug', 'general-discussion'])
    expect(cat).toMatchObject({ id: 'cat-general', slug: 'general-discussion' })
  })

  it('returns null for a missing slug', async () => {
    installed.categoryLookup = { data: null, error: null }
    expect(await getCategory('nope')).toBeNull()
  })

  it('falls back to null when the query errors (build resilience)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    installed.categoryLookup = { data: null, error: { message: 'kaboom' } }
    expect(await getCategory('x')).toBeNull()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})

// ===========================================================================
// listThreads — mapping, ordering, postCount, embed filter
// ===========================================================================

describe('listThreads', () => {
  it('returns [] when Supabase is not configured', async () => {
    isConfiguredMock.mockReturnValue(false)
    expect(await listThreads('cat-general')).toEqual([])
    expect(getServerClientMock).not.toHaveBeenCalled()
  })

  it('scopes to the category and filters the post-count embed to live posts', async () => {
    installed.threadsList = { data: [rawThread()], error: null }
    await listThreads('cat-general')
    expect(calls.from).toContain('forum_threads')
    expect(calls.eq).toContainEqual(['category_id', 'cat-general'])
    // Only live (non-deleted) posts are counted for postCount.
    expect(calls.eq).toContainEqual(['post_count.is_deleted', false])
  })

  it('orders PINNED-FIRST then last_activity_at desc', async () => {
    installed.threadsList = { data: [rawThread()], error: null }
    await listThreads('cat-general')
    expect(calls.order).toContainEqual(['is_pinned', { ascending: false }])
    expect(calls.order).toContainEqual(['last_activity_at', { ascending: false }])
    // is_pinned must be applied BEFORE last_activity_at (pinned-first sort key).
    const pinnedIdx = calls.order.findIndex((o) => o[0] === 'is_pinned')
    const activityIdx = calls.order.findIndex((o) => o[0] === 'last_activity_at')
    expect(pinnedIdx).toBeGreaterThanOrEqual(0)
    expect(pinnedIdx).toBeLessThan(activityIdx)
  })

  it('maps rows to ForumThread with author join + postCount from the embed', async () => {
    installed.threadsList = {
      data: [rawThread({ post_count: [{ count: 5 }] })],
      error: null,
    }
    const [thread] = await listThreads('cat-general')
    expect(thread).toMatchObject({
      id: '11111111-1111-1111-1111-111111111111',
      categoryId: 'cat-general',
      userId: 'user-A',
      title: 'A thread',
      slug: 'a-thread',
      isPinned: false,
      isLocked: false,
      showId: null,
      author: { username: 'alice', displayName: 'Alice', avatarUrl: 'https://cdn.example.com/a.png' },
      postCount: 5,
    })
  })

  it('defaults postCount to 0 when the embed is missing/empty', async () => {
    installed.threadsList = {
      data: [
        rawThread({ id: 't-empty', post_count: [] }),
        rawThread({ id: 't-null', post_count: null }),
      ],
      error: null,
    }
    const threads = await listThreads('cat-general')
    expect(threads.map((t) => t.postCount)).toEqual([0, 0])
  })

  it('normalizes an array-shaped author embed to a single author', async () => {
    installed.threadsList = {
      data: [
        rawThread({
          author: [{ username: 'bob', display_name: 'Bob', avatar_url: null }],
        }),
      ],
      error: null,
    }
    const [thread] = await listThreads('cat-general')
    expect(thread.author).toEqual({ username: 'bob', displayName: 'Bob', avatarUrl: null })
  })

  it('tolerates a null author embed with an all-null author', async () => {
    installed.threadsList = { data: [rawThread({ author: null })], error: null }
    const [thread] = await listThreads('cat-general')
    expect(thread.author).toEqual({ username: null, displayName: null, avatarUrl: null })
  })

  it('never leaks raw snake_case keys onto the thread', async () => {
    installed.threadsList = { data: [rawThread()], error: null }
    const [thread] = await listThreads('cat-general')
    expect(thread).not.toHaveProperty('category_id')
    expect(thread).not.toHaveProperty('user_id')
    expect(thread).not.toHaveProperty('is_pinned')
    expect(thread).not.toHaveProperty('last_activity_at')
    expect(thread).not.toHaveProperty('post_count')
    expect(thread.author).not.toHaveProperty('display_name')
    expect(thread.author).not.toHaveProperty('avatar_url')
  })

  it('falls back to [] when the query errors (build resilience)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    installed.threadsList = { data: null, error: { message: 'threads boom' } }
    expect(await listThreads('cat-general')).toEqual([])
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})

// ===========================================================================
// getThread — id|slug routing, posts oldest-first, deleted-body blanking
// ===========================================================================

describe('getThread', () => {
  const UUID = '11111111-1111-1111-1111-111111111111'

  it('returns null when Supabase is not configured', async () => {
    isConfiguredMock.mockReturnValue(false)
    expect(await getThread(UUID)).toBeNull()
    expect(getServerClientMock).not.toHaveBeenCalled()
  })

  it('queries by id (.eq id) when given a uuid', async () => {
    installed.threadLookup = { data: rawThread(), error: null }
    installed.postsList = { data: [rawPost()], error: null }
    await getThread(UUID)
    expect(calls.eq).toContainEqual(['id', UUID])
    expect(calls.eq).not.toContainEqual(['slug', UUID])
  })

  it('queries by slug (.eq slug) when given a non-uuid', async () => {
    installed.threadLookup = { data: rawThread(), error: null }
    installed.postsList = { data: [rawPost()], error: null }
    await getThread('a-thread')
    expect(calls.eq).toContainEqual(['slug', 'a-thread'])
    expect(calls.eq).not.toContainEqual(['id', 'a-thread'])
  })

  it('returns null when the thread is not found', async () => {
    installed.threadLookup = { data: null, error: null }
    expect(await getThread(UUID)).toBeNull()
  })

  it('returns the thread + posts (oldest-first), querying posts by thread_id ordered created_at asc', async () => {
    installed.threadLookup = { data: rawThread(), error: null }
    installed.postsList = {
      data: [
        rawPost({ id: 'p1', created_at: '2026-06-10T10:00:00.000Z' }),
        rawPost({ id: 'p2', created_at: '2026-06-10T11:00:00.000Z' }),
      ],
      error: null,
    }
    const thread = await getThread(UUID)
    expect(thread).not.toBeNull()
    expect(thread!.id).toBe(UUID)
    expect(calls.eq).toContainEqual(['thread_id', UUID])
    expect(calls.order).toContainEqual(['created_at', { ascending: true }])
    expect(thread!.posts.map((p) => p.id)).toEqual(['p1', 'p2'])
  })

  it('maps a post row to the camelCase domain ForumPost with author join', async () => {
    installed.threadLookup = { data: rawThread(), error: null }
    installed.postsList = { data: [rawPost()], error: null }
    const thread = await getThread(UUID)
    expect(thread!.posts[0]).toMatchObject({
      id: 'post-1',
      threadId: UUID,
      userId: 'user-A',
      body: 'First post body',
      isEdited: false,
      isDeleted: false,
      author: { username: 'alice', displayName: 'Alice', avatarUrl: 'https://cdn.example.com/a.png' },
    })
  })

  it('BLANKS the body of a soft-deleted post (original text never leaks)', async () => {
    installed.threadLookup = { data: rawThread(), error: null }
    installed.postsList = {
      data: [
        rawPost({
          id: 'gone',
          is_deleted: true,
          body: 'this text must never reach the caller',
        }),
      ],
      error: null,
    }
    const thread = await getThread(UUID)
    expect(thread!.posts[0].isDeleted).toBe(true)
    expect(thread!.posts[0].body).toBe('')
    expect(JSON.stringify(thread)).not.toContain('never reach')
  })

  it('never leaks raw snake_case keys onto a post', async () => {
    installed.threadLookup = { data: rawThread(), error: null }
    installed.postsList = { data: [rawPost()], error: null }
    const thread = await getThread(UUID)
    const post = thread!.posts[0]
    expect(post).not.toHaveProperty('thread_id')
    expect(post).not.toHaveProperty('user_id')
    expect(post).not.toHaveProperty('is_edited')
    expect(post).not.toHaveProperty('is_deleted')
    expect(post.author).not.toHaveProperty('display_name')
  })

  it('falls back to null when the thread read errors (build resilience)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    installed.threadLookup = { data: null, error: { message: 'read boom' } }
    expect(await getThread(UUID)).toBeNull()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('falls back to null when the posts read errors (build resilience)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    installed.threadLookup = { data: rawThread(), error: null }
    installed.postsList = { data: null, error: { message: 'posts boom' } }
    expect(await getThread(UUID)).toBeNull()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})

// ===========================================================================
// createThread — auth, server-side user_id, validation, thread + first post
// ===========================================================================

describe('createThread', () => {
  it('requires a session — returns an error, never touches the DB when signed out', async () => {
    getCurrentUserMock.mockResolvedValue(null)
    const result = await createThread('cat-general', 'Title', 'Body')
    expect(result).toEqual({ error: 'You must be signed in to start a thread.' })
    expect(getServerClientMock).not.toHaveBeenCalled()
    expect(calls.threadInserts).toHaveLength(0)
  })

  it('rejects an empty title before any DB call', async () => {
    getCurrentUserMock.mockResolvedValue(signedIn)
    const result = await createThread('cat-general', '   ', 'Body')
    expect(result).toEqual({ error: 'Title cannot be empty.' })
    expect(getServerClientMock).not.toHaveBeenCalled()
  })

  it('rejects an over-long title (>200) before any DB call', async () => {
    getCurrentUserMock.mockResolvedValue(signedIn)
    const result = await createThread('cat-general', 'x'.repeat(201), 'Body')
    expect(result).toMatchObject({ error: expect.stringContaining('200 characters') })
    expect(getServerClientMock).not.toHaveBeenCalled()
  })

  it('rejects an empty body before any DB call', async () => {
    getCurrentUserMock.mockResolvedValue(signedIn)
    const result = await createThread('cat-general', 'Title', '   ')
    expect(result).toEqual({ error: 'Message cannot be empty.' })
    expect(getServerClientMock).not.toHaveBeenCalled()
  })

  it('rejects an over-long body (>10000) before any DB call', async () => {
    getCurrentUserMock.mockResolvedValue(signedIn)
    const result = await createThread('cat-general', 'Title', 'x'.repeat(10001))
    expect(result).toMatchObject({ error: expect.stringContaining('10000 characters') })
    expect(getServerClientMock).not.toHaveBeenCalled()
  })

  it('rejects a non-existent category with a friendly error (no thread insert)', async () => {
    getCurrentUserMock.mockResolvedValue(signedIn)
    installed.categoryLookup = { data: null, error: null }
    const result = await createThread('cat-nope', 'Title', 'Body')
    expect(result).toEqual({ error: 'That category does not exist.' })
    expect(calls.threadInserts).toHaveLength(0)
  })

  it('creates the thread with user_id from the SESSION (never the client) + a slug', async () => {
    getCurrentUserMock.mockResolvedValue({ ...signedIn, userId: 'session-user' })
    installed.categoryLookup = { data: { id: 'cat-general', slug: 'general-discussion' }, error: null }
    installed.threadInsert = { data: { id: 'thread-99' }, error: null }
    installed.postInsert = { error: null }
    const result = await createThread('cat-general', 'My Cool Title!', 'First post')
    expect(result).toEqual({ threadId: 'thread-99' })
    const payload = calls.threadInserts[0] as Record<string, unknown>
    expect(payload.user_id).toBe('session-user')
    expect(payload.category_id).toBe('cat-general')
    expect(payload.title).toBe('My Cool Title!')
    expect(payload.slug).toBe('my-cool-title')
  })

  it('creates the first POST with user_id from the session and the trimmed body', async () => {
    getCurrentUserMock.mockResolvedValue({ ...signedIn, userId: 'session-user' })
    installed.categoryLookup = { data: { id: 'cat-general', slug: 'general-discussion' }, error: null }
    installed.threadInsert = { data: { id: 'thread-99' }, error: null }
    installed.postInsert = { error: null }
    await createThread('cat-general', 'Title', '  Hello world  ')
    expect(calls.postInserts).toHaveLength(1)
    const post = calls.postInserts[0] as Record<string, unknown>
    expect(post).toMatchObject({
      thread_id: 'thread-99',
      user_id: 'session-user',
      body: 'Hello world',
    })
  })

  it('does NOT send is_pinned / is_locked / last_activity_at on the thread insert', async () => {
    getCurrentUserMock.mockResolvedValue(signedIn)
    installed.threadInsert = { data: { id: 'thread-99' }, error: null }
    installed.postInsert = { error: null }
    await createThread('cat-general', 'Title', 'Body')
    const payload = calls.threadInserts[0] as Record<string, unknown>
    expect(payload).not.toHaveProperty('is_pinned')
    expect(payload).not.toHaveProperty('is_locked')
    expect(payload).not.toHaveProperty('last_activity_at')
    expect(payload).not.toHaveProperty('created_at')
  })

  it('surfaces a thread-insert error (e.g. RLS spoof rejection)', async () => {
    getCurrentUserMock.mockResolvedValue(signedIn)
    installed.threadInsert = {
      data: null,
      error: { message: 'new row violates row-level security policy' },
    }
    const result = await createThread('cat-general', 'Title', 'Body')
    expect(result).toEqual({ error: 'new row violates row-level security policy' })
    expect(calls.postInserts).toHaveLength(0)
  })

  it('rolls back the orphan thread if the first-post insert fails', async () => {
    getCurrentUserMock.mockResolvedValue(signedIn)
    installed.threadInsert = { data: { id: 'thread-99' }, error: null }
    installed.postInsert = { error: { message: 'post insert failed' } }
    const result = await createThread('cat-general', 'Title', 'Body')
    expect(result).toEqual({ error: 'post insert failed' })
    // The orphan thread was deleted.
    expect(calls.threadDeletes).toBe(1)
    expect(calls.eq).toContainEqual(['id', 'thread-99'])
  })

  it('revalidates the forum + category pages on success', async () => {
    getCurrentUserMock.mockResolvedValue(signedIn)
    installed.categoryLookup = { data: { id: 'cat-general', slug: 'general-discussion' }, error: null }
    installed.threadInsert = { data: { id: 'thread-99' }, error: null }
    installed.postInsert = { error: null }
    await createThread('cat-general', 'Title', 'Body')
    expect(revalidatePath).toHaveBeenCalledWith('/forum')
    expect(revalidatePath).toHaveBeenCalledWith('/forum/general-discussion')
  })
})

// ===========================================================================
// replyToThread — auth, locked-thread rejection, server-side user_id
// ===========================================================================

describe('replyToThread', () => {
  const TID = '11111111-1111-1111-1111-111111111111'

  it('requires a session', async () => {
    getCurrentUserMock.mockResolvedValue(null)
    const result = await replyToThread(TID, 'hi')
    expect(result).toEqual({ error: 'You must be signed in to reply.' })
    expect(getServerClientMock).not.toHaveBeenCalled()
  })

  it('rejects an empty body before any DB call', async () => {
    getCurrentUserMock.mockResolvedValue(signedIn)
    const result = await replyToThread(TID, '   ')
    expect(result).toEqual({ error: 'Message cannot be empty.' })
    expect(getServerClientMock).not.toHaveBeenCalled()
  })

  it('rejects a reply to a non-existent thread', async () => {
    getCurrentUserMock.mockResolvedValue(signedIn)
    installed.threadLookup = { data: null, error: null }
    const result = await replyToThread(TID, 'hi')
    expect(result).toEqual({ error: 'That thread does not exist.' })
    expect(calls.postInserts).toHaveLength(0)
  })

  it('REJECTS a reply to a LOCKED thread for a non-moderator (action-level guard)', async () => {
    getCurrentUserMock.mockResolvedValue(signedIn) // profile: null -> not a mod
    installed.threadLookup = {
      data: { id: TID, slug: 'a-thread', is_locked: true },
      error: null,
    }
    const result = await replyToThread(TID, 'sneaky reply')
    expect(result).toEqual({ error: 'This thread is locked.' })
    // No insert attempted — rejected before touching forum_posts.
    expect(calls.postInserts).toHaveLength(0)
  })

  it('ALLOWS a moderator to reply to a LOCKED thread', async () => {
    getCurrentUserMock.mockResolvedValue(signedInMod)
    installed.threadLookup = {
      data: { id: TID, slug: 'a-thread', is_locked: true },
      error: null,
    }
    installed.postInsert = { error: null }
    const result = await replyToThread(TID, 'mod closing note')
    expect(result).toEqual({})
    expect(calls.postInserts).toHaveLength(1)
  })

  it('inserts the reply with user_id from the SESSION (never the client)', async () => {
    getCurrentUserMock.mockResolvedValue({ ...signedIn, userId: 'session-user' })
    installed.threadLookup = {
      data: { id: TID, slug: 'a-thread', is_locked: false },
      error: null,
    }
    installed.postInsert = { error: null }
    await replyToThread(TID, '  padded reply  ')
    const post = calls.postInserts[0] as Record<string, unknown>
    expect(post).toMatchObject({
      thread_id: TID,
      user_id: 'session-user',
      body: 'padded reply',
    })
  })

  it('does NOT send is_deleted / is_edited / created_at on the reply insert', async () => {
    getCurrentUserMock.mockResolvedValue(signedIn)
    installed.threadLookup = { data: { id: TID, slug: 'a-thread', is_locked: false }, error: null }
    installed.postInsert = { error: null }
    await replyToThread(TID, 'hi')
    const post = calls.postInserts[0] as Record<string, unknown>
    expect(post).not.toHaveProperty('is_deleted')
    expect(post).not.toHaveProperty('is_edited')
    expect(post).not.toHaveProperty('created_at')
  })

  it('surfaces a Supabase insert error onto { error }', async () => {
    getCurrentUserMock.mockResolvedValue(signedIn)
    installed.threadLookup = { data: { id: TID, slug: 'a-thread', is_locked: false }, error: null }
    installed.postInsert = { error: { message: 'new row violates row-level security policy' } }
    const result = await replyToThread(TID, 'hi')
    expect(result).toEqual({ error: 'new row violates row-level security policy' })
  })

  it('revalidates the thread page on success', async () => {
    getCurrentUserMock.mockResolvedValue(signedIn)
    installed.threadLookup = { data: { id: TID, slug: 'a-thread', is_locked: false }, error: null }
    installed.postInsert = { error: null }
    await replyToThread(TID, 'hi')
    expect(revalidatePath).toHaveBeenCalledWith(`/forum/thread/${TID}`)
  })
})

// ===========================================================================
// editPost — auth, owner-scope, is_edited, no ownership tampering
// ===========================================================================

describe('editPost', () => {
  it('requires a session', async () => {
    getCurrentUserMock.mockResolvedValue(null)
    const result = await editPost('post-1', 'new body')
    expect(result).toEqual({ error: 'You must be signed in to edit a post.' })
    expect(getServerClientMock).not.toHaveBeenCalled()
  })

  it('rejects an empty body before any DB call', async () => {
    getCurrentUserMock.mockResolvedValue(signedIn)
    const result = await editPost('post-1', '   ')
    expect(result).toEqual({ error: 'Message cannot be empty.' })
    expect(getServerClientMock).not.toHaveBeenCalled()
  })

  it('sets is_edited=true and scopes by id AND owner AND is_deleted=false', async () => {
    getCurrentUserMock.mockResolvedValue({ ...signedIn, userId: 'owner-1' })
    installed.postUpdate = { data: { thread_id: 't-1' }, error: null }
    const result = await editPost('post-9', 'updated body')
    expect(result).toEqual({})
    expect(calls.postUpdates[0]).toEqual({ body: 'updated body', is_edited: true })
    expect(calls.eq).toContainEqual(['id', 'post-9'])
    expect(calls.eq).toContainEqual(['user_id', 'owner-1'])
    expect(calls.eq).toContainEqual(['is_deleted', false])
  })

  it('does NOT write user_id / thread_id / is_deleted (no ownership tampering)', async () => {
    getCurrentUserMock.mockResolvedValue(signedIn)
    installed.postUpdate = { data: { thread_id: 't-1' }, error: null }
    await editPost('post-9', 'updated body')
    const payload = calls.postUpdates[0] as Record<string, unknown>
    expect(payload).not.toHaveProperty('user_id')
    expect(payload).not.toHaveProperty('thread_id')
    expect(payload).not.toHaveProperty('is_deleted')
  })

  it('maps a zero-row update (wrong owner / deleted) to a "not yours" error', async () => {
    getCurrentUserMock.mockResolvedValue(signedIn)
    installed.postUpdate = { data: null, error: null }
    const result = await editPost('someone-elses', 'hax')
    expect(result).toEqual({ error: 'Post not found or not yours to edit.' })
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('surfaces a Supabase error onto { error }', async () => {
    getCurrentUserMock.mockResolvedValue(signedIn)
    installed.postUpdate = { data: null, error: { message: 'permission denied for column user_id' } }
    const result = await editPost('post-1', 'x')
    expect(result).toEqual({ error: 'permission denied for column user_id' })
  })

  it('revalidates the thread page (from the returned thread_id) on success', async () => {
    getCurrentUserMock.mockResolvedValue(signedIn)
    installed.postUpdate = { data: { thread_id: 't-77' }, error: null }
    await editPost('post-1', 'edited')
    expect(revalidatePath).toHaveBeenCalledWith('/forum/thread/t-77')
  })
})

// ===========================================================================
// deletePost — auth, SOFT delete, NOT scoped by user_id (mod-or-owner via RLS)
// ===========================================================================

describe('deletePost', () => {
  it('requires a session', async () => {
    getCurrentUserMock.mockResolvedValue(null)
    const result = await deletePost('post-1')
    expect(result).toEqual({ error: 'You must be signed in to delete a post.' })
    expect(getServerClientMock).not.toHaveBeenCalled()
  })

  it('SOFT-deletes: sets is_deleted=true and BLANKS the body (no row DELETE)', async () => {
    getCurrentUserMock.mockResolvedValue(signedIn)
    installed.postUpdate = { data: { thread_id: 't-1' }, error: null }
    const result = await deletePost('post-9')
    expect(result).toEqual({})
    const payload = calls.postUpdates[0] as Record<string, unknown>
    expect(payload.is_deleted).toBe(true)
    expect(payload.body).toBe('')
  })

  it('does NOT scope by user_id (so RLS can let a MODERATOR delete any post)', async () => {
    getCurrentUserMock.mockResolvedValue(signedInMod)
    installed.postUpdate = { data: { thread_id: 't-1' }, error: null }
    await deletePost('someones-post')
    // Scoped by id only; ownership is enforced by RLS (own OR is_moderator()).
    expect(calls.eq).toContainEqual(['id', 'someones-post'])
    expect(calls.eq).not.toContainEqual(['user_id', 'mod-1'])
  })

  it('does NOT write user_id / thread_id during a delete', async () => {
    getCurrentUserMock.mockResolvedValue(signedIn)
    installed.postUpdate = { data: { thread_id: 't-1' }, error: null }
    await deletePost('post-9')
    const payload = calls.postUpdates[0] as Record<string, unknown>
    expect(payload).not.toHaveProperty('user_id')
    expect(payload).not.toHaveProperty('thread_id')
  })

  it('maps a zero-row update (not allowed) to a "not allowed" error', async () => {
    getCurrentUserMock.mockResolvedValue(signedIn)
    installed.postUpdate = { data: null, error: null }
    const result = await deletePost('not-mine')
    expect(result).toEqual({ error: 'Post not found or not allowed.' })
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('surfaces a Supabase error onto { error }', async () => {
    getCurrentUserMock.mockResolvedValue(signedIn)
    installed.postUpdate = { data: null, error: { message: 'db down' } }
    const result = await deletePost('post-1')
    expect(result).toEqual({ error: 'db down' })
  })

  it('revalidates the thread page on success', async () => {
    getCurrentUserMock.mockResolvedValue(signedIn)
    installed.postUpdate = { data: { thread_id: 't-88' }, error: null }
    await deletePost('post-1')
    expect(revalidatePath).toHaveBeenCalledWith('/forum/thread/t-88')
  })
})

// ===========================================================================
// pinThread / lockThread — moderator role pre-check
// ===========================================================================

describe('pinThread', () => {
  it('requires a session', async () => {
    getCurrentUserMock.mockResolvedValue(null)
    const result = await pinThread('t-1', true)
    expect(result).toEqual({ error: 'You must be signed in.' })
    expect(getServerClientMock).not.toHaveBeenCalled()
  })

  it('REJECTS a non-moderator BEFORE any DB write (role pre-check)', async () => {
    getCurrentUserMock.mockResolvedValue(signedIn) // role user (profile null)
    const result = await pinThread('t-1', true)
    expect(result).toEqual({ error: 'Only moderators can pin threads.' })
    expect(getServerClientMock).not.toHaveBeenCalled()
    expect(calls.threadUpdates).toHaveLength(0)
  })

  it('REJECTS a plain user even when a profile exists with role=user', async () => {
    getCurrentUserMock.mockResolvedValue({
      ...signedIn,
      profile: {
        id: 'user-A',
        username: 'a',
        displayName: 'A',
        avatarUrl: null,
        role: 'user' as const,
        createdAt: '2026-06-01T00:00:00.000Z',
        updatedAt: '2026-06-01T00:00:00.000Z',
      },
    })
    const result = await pinThread('t-1', true)
    expect(result).toEqual({ error: 'Only moderators can pin threads.' })
    expect(getServerClientMock).not.toHaveBeenCalled()
  })

  it('ALLOWS a moderator to pin, writing is_pinned', async () => {
    getCurrentUserMock.mockResolvedValue(signedInMod)
    installed.threadUpdate = { data: { id: 't-1', category_id: 'cat-general' }, error: null }
    const result = await pinThread('t-1', true)
    expect(result).toEqual({})
    expect(calls.threadUpdates[0]).toEqual({ is_pinned: true })
    expect(calls.eq).toContainEqual(['id', 't-1'])
  })

  it('ALLOWS an admin to pin', async () => {
    getCurrentUserMock.mockResolvedValue({
      ...signedInMod,
      profile: { ...signedInMod.profile, role: 'admin' as const },
    })
    installed.threadUpdate = { data: { id: 't-1', category_id: 'cat-general' }, error: null }
    expect(await pinThread('t-1', true)).toEqual({})
  })

  it('maps a zero-row update to a "not allowed" error', async () => {
    getCurrentUserMock.mockResolvedValue(signedInMod)
    installed.threadUpdate = { data: null, error: null }
    const result = await pinThread('t-1', true)
    expect(result).toEqual({ error: 'Thread not found or not allowed.' })
  })

  it('revalidates the forum + thread page on success', async () => {
    getCurrentUserMock.mockResolvedValue(signedInMod)
    installed.threadUpdate = { data: { id: 't-1', category_id: 'cat-general' }, error: null }
    await pinThread('t-1', true)
    expect(revalidatePath).toHaveBeenCalledWith('/forum')
    expect(revalidatePath).toHaveBeenCalledWith('/forum/thread/t-1')
  })
})

describe('lockThread', () => {
  it('requires a session', async () => {
    getCurrentUserMock.mockResolvedValue(null)
    const result = await lockThread('t-1', true)
    expect(result).toEqual({ error: 'You must be signed in.' })
    expect(getServerClientMock).not.toHaveBeenCalled()
  })

  it('REJECTS a non-moderator BEFORE any DB write (role pre-check)', async () => {
    getCurrentUserMock.mockResolvedValue(signedIn)
    const result = await lockThread('t-1', true)
    expect(result).toEqual({ error: 'Only moderators can lock threads.' })
    expect(getServerClientMock).not.toHaveBeenCalled()
    expect(calls.threadUpdates).toHaveLength(0)
  })

  it('ALLOWS a moderator to lock, writing is_locked', async () => {
    getCurrentUserMock.mockResolvedValue(signedInMod)
    installed.threadUpdate = { data: { id: 't-1' }, error: null }
    const result = await lockThread('t-1', true)
    expect(result).toEqual({})
    expect(calls.threadUpdates[0]).toEqual({ is_locked: true })
    expect(calls.eq).toContainEqual(['id', 't-1'])
  })

  it('supports unlocking (is_locked=false)', async () => {
    getCurrentUserMock.mockResolvedValue(signedInMod)
    installed.threadUpdate = { data: { id: 't-1' }, error: null }
    await lockThread('t-1', false)
    expect(calls.threadUpdates[0]).toEqual({ is_locked: false })
  })

  it('maps a zero-row update to a "not allowed" error', async () => {
    getCurrentUserMock.mockResolvedValue(signedInMod)
    installed.threadUpdate = { data: null, error: null }
    const result = await lockThread('t-1', true)
    expect(result).toEqual({ error: 'Thread not found or not allowed.' })
  })

  it('revalidates the thread page on success', async () => {
    getCurrentUserMock.mockResolvedValue(signedInMod)
    installed.threadUpdate = { data: { id: 't-1' }, error: null }
    await lockThread('t-1', true)
    expect(revalidatePath).toHaveBeenCalledWith('/forum/thread/t-1')
  })
})

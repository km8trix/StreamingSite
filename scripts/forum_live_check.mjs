// Live security checks for the FORUM data layer (M3 Feature 3).
// Runs against the local Supabase stack using the exact supabase-js path the app
// uses. Reads keys from .env.local. Run: node scripts/forum_live_check.mjs
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
// Node 20 has no global WebSocket; supabase-js's realtime client constructs
// eagerly and throws if globalThis.WebSocket is undefined. We never open a
// realtime channel (only REST + auth), so a no-op stub satisfies the detection.
if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = class {
    constructor() { throw new Error('realtime not used in this check') }
  }
}
import { createClient } from '@supabase/supabase-js'

// --- load .env.local (Node doesn't auto-load it) --------------------------
const env = {}
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const URL = env.NEXT_PUBLIC_SUPABASE_URL
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !ANON || !SERVICE) throw new Error('missing env keys')

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } })

let pass = 0
let fail = 0
const ok = (label) => { pass++; console.log('PASS:', label) }
const bad = (label, detail) => { fail++; console.log('FAIL:', label, '::', detail) }

// Create a fresh user + return an authenticated anon-key client (the app path).
async function makeUser(tag) {
  const email = `forumchk+${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`
  const password = 'password123'
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { username: `chk_${tag}_${Math.floor(Math.random() * 1e6)}` },
  })
  if (error) throw new Error('createUser ' + error.message)
  const client = createClient(URL, ANON, { auth: { persistSession: false } })
  const { error: signInErr } = await client.auth.signInWithPassword({ email, password })
  if (signInErr) throw new Error('signIn ' + signInErr.message)
  return { client, userId: data.user.id, email }
}

async function run() {
  // ---- 0. public SELECT categories (anon) --------------------------------
  const anon = createClient(URL, ANON, { auth: { persistSession: false } })
  {
    const { data, error } = await anon.from('forum_categories').select('id, slug').order('sort_order')
    if (error) bad('anon SELECT categories', error.message)
    else if (data.length >= 4) ok(`anon SELECT categories (${data.length} seeded: ${data.map(c => c.slug).join(', ')})`)
    else bad('anon SELECT categories', `expected >=4, got ${data.length}`)
  }

  // ---- set up two users -------------------------------------------------
  const A = await makeUser('a')
  const B = await makeUser('b')

  // ---- 1. legit thread + first post (user A) ----------------------------
  let threadId, firstPostId
  {
    const { data, error } = await A.client.from('forum_threads').insert({
      category_id: 'cat-general', user_id: A.userId, title: 'A check thread', slug: 'a-check-thread',
    }).select('id').single()
    if (error) { bad('A insert own thread', error.message) }
    else { threadId = data.id; ok('A insert own thread (own user_id)') }
  }
  {
    const { data, error } = await A.client.from('forum_posts').insert({
      thread_id: threadId, user_id: A.userId, body: 'First post by A',
    }).select('id').single()
    if (error) bad('A insert own first post', error.message)
    else { firstPostId = data.id; ok('A insert own first post') }
  }

  // ---- 2. SPOOFED user_id INSERT must be REJECTED -----------------------
  {
    const { error } = await B.client.from('forum_threads').insert({
      category_id: 'cat-general', user_id: A.userId, title: 'spoof thread', slug: 'spoof',
    })
    if (error && (error.code === '42501' || /row-level security/i.test(error.message)))
      ok('SPOOF thread insert as another user REJECTED (' + error.code + ')')
    else bad('SPOOF thread insert', error ? error.message : 'UNEXPECTEDLY ALLOWED')
  }
  {
    const { error } = await B.client.from('forum_posts').insert({
      thread_id: threadId, user_id: A.userId, body: 'spoof post',
    })
    if (error && (error.code === '42501' || /row-level security/i.test(error.message)))
      ok('SPOOF post insert as another user REJECTED (' + error.code + ')')
    else bad('SPOOF post insert', error ? error.message : 'UNEXPECTEDLY ALLOWED')
  }

  // ---- 3. last_activity_at bumped by trigger on new post ----------------
  {
    const { data: before } = await anon.from('forum_threads').select('last_activity_at').eq('id', threadId).single()
    await new Promise(r => setTimeout(r, 1100))
    const { error } = await B.client.from('forum_posts').insert({ thread_id: threadId, user_id: B.userId, body: 'B reply' })
    if (error) bad('B reply to unlocked thread', error.message)
    else {
      const { data: after } = await anon.from('forum_threads').select('last_activity_at').eq('id', threadId).single()
      if (new Date(after.last_activity_at) > new Date(before.last_activity_at)) ok('last_activity_at bumped by trigger on new post')
      else bad('last_activity_at trigger', `before=${before.last_activity_at} after=${after.last_activity_at}`)
    }
  }

  // ---- 4. NON-MOD cannot pin/lock another's thread ----------------------
  {
    const { data, error } = await B.client.from('forum_threads').update({ is_pinned: true }).eq('id', threadId).select('id')
    // RLS USING filters out the row → 0 rows updated (no error). Verify unchanged.
    const { data: row } = await anon.from('forum_threads').select('is_pinned').eq('id', threadId).single()
    if (!row.is_pinned && (!data || data.length === 0)) ok('NON-MOD pin of another user thread REJECTED (0 rows, still unpinned)')
    else bad('NON-MOD pin', error ? error.message : `is_pinned=${row.is_pinned}`)
  }
  {
    await B.client.from('forum_threads').update({ is_locked: true }).eq('id', threadId)
    const { data: row } = await anon.from('forum_threads').select('is_locked').eq('id', threadId).single()
    if (!row.is_locked) ok('NON-MOD lock of another user thread REJECTED (still unlocked)')
    else bad('NON-MOD lock', 'thread got locked by non-mod')
  }

  // ---- 4b. NON-MOD AUTHOR cannot pin/lock their OWN thread --------------
  // The contract restricts is_pinned/is_locked to moderators. RLS WITH CHECK
  // pins those flags for non-mods even on their own row.
  {
    const { error } = await A.client.from('forum_threads').update({ is_pinned: true }).eq('id', threadId)
    const { data: row } = await anon.from('forum_threads').select('is_pinned').eq('id', threadId).single()
    if (!row.is_pinned) ok('NON-MOD author pin of OWN thread REJECTED (flag restricted to mods)')
    else bad('NON-MOD author self-pin', error ? error.message : 'self-pin was allowed')
  }
  {
    const { error } = await A.client.from('forum_threads').update({ is_locked: true }).eq('id', threadId)
    const { data: row } = await anon.from('forum_threads').select('is_locked').eq('id', threadId).single()
    if (!row.is_locked) ok('NON-MOD author lock of OWN thread REJECTED (flag restricted to mods)')
    else bad('NON-MOD author self-lock', error ? error.message : 'self-lock was allowed')
  }
  // Author CAN still rename their own thread (title is author-writable).
  {
    const { data, error } = await A.client.from('forum_threads').update({ title: 'A renamed thread' }).eq('id', threadId).select('title').maybeSingle()
    if (!error && data?.title === 'A renamed thread') ok('author CAN rename own thread (title writable)')
    else bad('author rename', error ? error.message : `title=${data?.title}`)
  }

  // ---- 5. NON-MOD cannot delete another user's post ---------------------
  {
    // B tries to soft-delete A's first post.
    await B.client.from('forum_posts').update({ is_deleted: true, body: '' }).eq('id', firstPostId)
    const { data: row } = await anon.from('forum_posts').select('is_deleted, body').eq('id', firstPostId).single()
    if (!row.is_deleted && row.body === 'First post by A') ok('NON-MOD soft-delete of another user post REJECTED (intact)')
    else bad('NON-MOD delete', `is_deleted=${row.is_deleted} body="${row.body}"`)
  }
  {
    // B tries to hard-delete A's first post.
    await B.client.from('forum_posts').delete().eq('id', firstPostId)
    const { data: row } = await anon.from('forum_posts').select('id').eq('id', firstPostId).maybeSingle()
    if (row) ok('NON-MOD hard-delete of another user post REJECTED (row still exists)')
    else bad('NON-MOD hard-delete', 'row was deleted by non-mod')
  }

  // ---- 6. column-restricted grant: cannot tamper user_id via UPDATE -----
  {
    const { error } = await A.client.from('forum_posts').update({ user_id: B.userId }).eq('id', firstPostId)
    if (error && /permission denied|column/i.test(error.message)) ok('UPDATE user_id (re-own) REJECTED by column grant')
    else {
      const { data: row } = await anon.from('forum_posts').select('user_id').eq('id', firstPostId).single()
      if (row.user_id === A.userId) ok('UPDATE user_id (re-own) had no effect (still A)')
      else bad('re-own post', `user_id now ${row.user_id}`)
    }
  }

  // ---- 7. one-way soft-delete ratchet (A deletes own, then tries revive)-
  {
    await A.client.from('forum_posts').update({ is_deleted: true, body: '' }).eq('id', firstPostId)
    // Try to un-delete + repopulate.
    await A.client.from('forum_posts').update({ is_deleted: false, body: 'REVIVED' }).eq('id', firstPostId).eq('user_id', A.userId)
    const { data: row } = await anon.from('forum_posts').select('is_deleted, body').eq('id', firstPostId).single()
    if (row.is_deleted && row.body === '') ok('one-way delete ratchet: cannot un-delete/repopulate own post')
    else bad('delete ratchet', `is_deleted=${row.is_deleted} body="${row.body}"`)
  }

  // ---- 8. MODERATOR can pin/lock/delete (promote B) ---------------------
  // Promoting a user to moderator is an ADMIN- only operation. `role` is
  // deliberately not in any PostgREST column grant (0003 hardening — stops
  // self-escalation via REST), so even the service_role REST client gets
  // "permission denied for table" trying to PATCH it. The realistic admin path
  // is a direct privileged SQL UPDATE (runs as the postgres superuser, which
  // bypasses both RLS and PostgREST column grants). We do that via the local
  // Supabase Postgres container.
  {
    // Create A's second post BEFORE we lock the thread (a non-mod can't post in
    // a locked thread — that is exactly what step 9 verifies).
    const { data: aPost, error: aPostErr } = await A.client
      .from('forum_posts')
      .insert({ thread_id: threadId, user_id: A.userId, body: 'A second post' })
      .select('id')
      .single()
    if (aPostErr || !aPost) { bad('setup A second post', aPostErr?.message); return finish() }

    // Promote B. `role` is intentionally not in any PostgREST column grant
    // (0003 hardening — stops self-escalation via REST), so even the service_role
    // REST client gets "permission denied for table" trying to PATCH or even read
    // it alone. The realistic admin path is a privileged SQL UPDATE as the
    // postgres superuser (bypasses RLS + column grants) via the local container.
    const verify = execFileSync('docker', [
      'exec', 'supabase_db_StreamingSite', 'psql', '-U', 'postgres', '-d', 'postgres',
      '-tAc', `update public.profiles set role='moderator' where id='${B.userId}'; select role from public.profiles where id='${B.userId}';`,
    ], { encoding: 'utf8' })
    if (/moderator/.test(verify)) ok('promoted B to moderator via privileged SQL')
    else bad('promote moderator', `verify="${verify.trim()}"`)

    const { data: pinData, error: pinErr } = await B.client.from('forum_threads').update({ is_pinned: true }).eq('id', threadId).select('id')
    const { data: pinned } = await anon.from('forum_threads').select('is_pinned').eq('id', threadId).single()
    if (pinned.is_pinned) ok('MODERATOR can pin another user thread')
    else bad('MOD pin', pinErr ? pinErr.message : `is_pinned=${pinned.is_pinned}, rows=${pinData?.length}`)

    await B.client.from('forum_threads').update({ is_locked: true }).eq('id', threadId)
    const { data: locked } = await anon.from('forum_threads').select('is_locked').eq('id', threadId).single()
    if (locked.is_locked) ok('MODERATOR can lock another user thread')
    else bad('MOD lock', 'not locked')

    // MOD soft-deletes A's (now-existing) second post.
    await B.client.from('forum_posts').update({ is_deleted: true, body: '' }).eq('id', aPost.id)
    const { data: delRow } = await anon.from('forum_posts').select('is_deleted').eq('id', aPost.id).single()
    if (delRow.is_deleted) ok('MODERATOR can soft-delete another user post')
    else bad('MOD delete', 'post not deleted')

    // MOD can post in a locked thread (insert policy allows is_moderator()).
    const { error: modPostErr } = await B.client.from('forum_posts').insert({ thread_id: threadId, user_id: B.userId, body: 'mod note in locked thread' })
    if (!modPostErr) ok('MODERATOR can post in a locked thread')
    else bad('MOD post in locked thread', modPostErr.message)
  }

  // ---- 9. NON-MOD cannot post in a locked thread (A is not a mod) -------
  {
    const { error } = await A.client.from('forum_posts').insert({ thread_id: threadId, user_id: A.userId, body: 'A tries locked' })
    if (error && (error.code === '42501' || /row-level security/i.test(error.message)))
      ok('NON-MOD post in locked thread REJECTED (' + error.code + ')')
    else bad('NON-MOD locked post', error ? error.message : 'UNEXPECTEDLY ALLOWED')
  }

  async function finish() {
    await admin.from('forum_threads').delete().eq('id', threadId)
    await admin.auth.admin.deleteUser(A.userId)
    await admin.auth.admin.deleteUser(B.userId)
    console.log(`\n==== ${pass} passed, ${fail} failed ====`)
    process.exit(fail === 0 ? 0 : 1)
  }

  await finish()
}

run().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(2) })

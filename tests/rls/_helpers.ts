// Shared harness for the RLS test suite.
//
// These tests run against a REAL local Supabase (Postgres enforces RLS — it
// cannot be mocked). They are deliberately NOT part of `npm test`; run them with
// `npm run test:rls` after `npm run db:start && npm run db:reset` (see
// tests/rls/README.md).
//
// Credentials are resolved from env (so CI can inject them) or, failing that,
// from the local Supabase CLI (`supabase status -o env`). The local anon /
// service keys are the well-known dev keys and only work against 127.0.0.1.

import { execSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { WebSocket as UndiciWebSocket } from 'undici'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// supabase-js eagerly constructs a Realtime client that needs a global
// WebSocket; Node < 22 has none. We never use realtime here — this only
// satisfies the constructor. undici ships with Next.js, so no new dependency.
if (typeof globalThis.WebSocket === 'undefined') {
  // @ts-expect-error undici's WebSocket satisfies the runtime contract supabase-js needs
  globalThis.WebSocket = UndiciWebSocket
}

type Conn = { url: string; anonKey: string; serviceKey: string; dbUrl: string }

let cached: Conn | null = null

/** Resolve the local Supabase URL, anon/service keys, and superuser DB URL. */
export function conn(): Conn {
  if (cached) return cached

  let url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  let anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  let serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  let dbUrl = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL

  if (!url || !anonKey || !serviceKey || !dbUrl) {
    let env: string
    try {
      env = execSync('npx supabase status -o env', {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      })
    } catch {
      throw new Error(
        'Local Supabase is not running. Start it with `npm run db:start` and apply ' +
          'migrations with `npm run db:reset`, then re-run `npm run test:rls`.',
      )
    }
    const pick = (k: string) =>
      env.match(new RegExp(`^${k}="?([^"\\n]+)"?`, 'm'))?.[1]
    url ||= pick('API_URL')
    anonKey ||= pick('ANON_KEY')
    serviceKey ||= pick('SERVICE_ROLE_KEY')
    dbUrl ||= pick('DB_URL')
  }

  if (!url || !anonKey || !serviceKey || !dbUrl) {
    throw new Error('Could not resolve local Supabase credentials (URL/anon/service/DB).')
  }
  cached = { url, anonKey, serviceKey, dbUrl }
  return cached
}

// Direct superuser (postgres) connection. This project deliberately grants
// service_role NO table DML (only anon/authenticated get SELECT/etc.), so RLS
// setup, role elevation, and raw cross-RLS verification go through SQL as the
// `postgres` superuser, which has BYPASSRLS + full DML.
let pool: Pool | null = null

export function db(): Pool {
  if (!pool) pool = new Pool({ connectionString: conn().dbUrl, max: 4 })
  return pool
}

async function closeDb(): Promise<void> {
  if (pool) {
    const p = pool
    pool = null
    await p.end()
  }
}

const noPersist = { auth: { persistSession: false, autoRefreshToken: false } }

/** Anonymous client — Postgres role `anon`, no session. RLS applies as anon. */
export function anonClient(): SupabaseClient {
  const c = conn()
  return createClient(c.url, c.anonKey, noPersist)
}

/** Service-role client — BYPASSES RLS. Use only for setup/teardown + raw asserts. */
export function serviceClient(): SupabaseClient {
  const c = conn()
  return createClient(c.url, c.serviceKey, noPersist)
}

export type TestUser = { client: SupabaseClient; id: string; email: string }

// Every user created via newUser() is tracked here so afterAll can delete them
// (cascades to their profiles + owned rows). Files run sequentially, so a single
// shared registry is safe.
const createdUserIds: string[] = []

/**
 * Create a confirmed auth user (which fires handle_new_user → a profiles row),
 * optionally elevate its role, and return a client authenticated AS that user so
 * RLS evaluates `auth.uid()` to this id.
 */
export async function newUser(
  role: 'user' | 'moderator' | 'admin' = 'user',
): Promise<TestUser> {
  const admin = serviceClient()
  const email = `rls-${randomUUID()}@example.test`
  const password = `pw-${randomUUID()}`

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error || !data.user) throw error ?? new Error('admin.createUser returned no user')
  const id = data.user.id
  createdUserIds.push(id)

  if (role !== 'user') {
    // Elevate via superuser SQL — a client can never set its own `role`
    // (the column isn't in the UPDATE grant; asserted in profiles.rls.test.ts).
    await db().query('update public.profiles set role = $1 where id = $2', [role, id])
  }

  const client = createClient(conn().url, conn().anonKey, noPersist)
  const { error: signInErr } = await client.auth.signInWithPassword({ email, password })
  if (signInErr) throw signInErr

  return { client, id, email }
}

/**
 * Delete every user newUser() created and close the DB pool. Call in afterAll.
 * Deleting the auth user cascades to its profile + owned rows (FK on delete
 * cascade), so per-test rows clean themselves up.
 */
export async function cleanup(): Promise<void> {
  const admin = serviceClient()
  await Promise.all(
    createdUserIds.splice(0).map((id) =>
      admin.auth.admin.deleteUser(id).catch(() => {}),
    ),
  )
  await closeDb()
}

/** A known-existing show id (FK target for watchlist/progress). */
export async function anyShowId(): Promise<string> {
  const { rows } = await db().query<{ id: string }>(
    'select id from public.shows order by id limit 1',
  )
  if (!rows[0]) throw new Error('no shows seeded')
  return rows[0].id
}

/** A valid (show_id, episode_id) pair for record_watch_progress. */
export async function anyEpisode(): Promise<{ showId: string; episodeId: string }> {
  const { rows } = await db().query<{ id: string; show_id: string }>(
    'select id, show_id from public.episodes limit 1',
  )
  if (!rows[0]) throw new Error('no episodes seeded')
  return { showId: rows[0].show_id, episodeId: rows[0].id }
}

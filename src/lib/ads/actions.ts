'use server'

// Client-importable entry point for the ad tracking actions.
//
// `src/lib/data/ads.ts` is a regular module (it imports the server Supabase
// client at module scope). Importing it — or the `@/lib/data` barrel that
// re-exports it — from a Client Component drags that server-only module into the
// client bundle and breaks the build.
//
// This is a TOP-LEVEL 'use server' module that DEFINES thin async wrappers
// delegating to the data layer. Importing these from a Client Component produces
// server-action references (not a code import), so the server-only imports stay
// on the server — the same pattern the auth / comments / forum UIs use. A bare
// `export { … } from …` re-export does NOT register as actions here, so each
// must be a real `async function` declaration.
//
// Both are best-effort, fire-and-forget analytics counters (the data layer
// swallows failures and no-ops on the seed-fallback path); they only forward.

import {
  recordAdClick as recordAdClickImpl,
  recordAdImpression as recordAdImpressionImpl,
} from '@/lib/data/ads'

export async function recordAdImpression(id: string): Promise<void> {
  return recordAdImpressionImpl(id)
}

export async function recordAdClick(id: string): Promise<void> {
  return recordAdClickImpl(id)
}

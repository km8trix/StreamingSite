import { defineConfig } from 'vitest/config'

// RLS test suite — runs against a REAL local Supabase (see tests/rls/README.md).
// Separate from the default unit config (vitest.config.ts) so `npm test` stays
// DB-free and fast; this layer is opt-in via `npm run test:rls`.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/rls/**/*.rls.test.ts'],
    // One shared database — run files sequentially to keep assertions isolated
    // and avoid connection storms / counter races (ads).
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
})

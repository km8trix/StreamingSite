import { defineConfig, devices } from '@playwright/test'

const PORT = 3000
const baseURL = `http://localhost:${PORT}`
const isCI = !!process.env.CI

// Pin the e2e suite to the LOCAL Supabase (supabase start / Docker). These tests
// are local-only by construction — the adversarial specs shell into the
// `supabase_db_StreamingSite` container and the live specs sign up real users —
// so they must NEVER run against the remote/production project. Because the app
// inlines NEXT_PUBLIC_* at BUILD time and the webServer below runs `next build`,
// a `.env.local` pointing at the remote project would otherwise compile the app
// against production and the suite would fail (e.g. GoTrue "email rate limit
// exceeded" on signup). We set these BEFORE defineConfig so they are inherited
// by the spawned `npm run build && npm run start` and read by the in-process
// e2e helpers (which prefer process.env). `??=` leaves any explicit override
// (e.g. a deliberately-exported shell value) untouched. The values are the
// well-known, non-secret Supabase local-dev demo keys.
process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'http://127.0.0.1:54321'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??=
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
process.env.SUPABASE_SERVICE_ROLE_KEY ??=
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

// E2E config. The webServer builds then starts the production app (more stable
// than `next dev` for SSG/route-handler assertions). reuseExistingServer locally
// lets you point at an already-running `npm run start` to iterate faster.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 1 : undefined,
  reporter: [['list']],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run build && npm run start',
    url: baseURL,
    reuseExistingServer: !isCI,
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})

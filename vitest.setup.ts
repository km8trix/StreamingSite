import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// The data layer (@/lib/data) transitively imports @/lib/supabase/server,
// which imports `next/headers` — unavailable in the jsdom/vitest environment.
// We only ever exercise the seed-fallback path in unit tests (no Supabase env),
// so getServerClient() is never actually invoked; stubbing the module keeps the
// import graph loadable.
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    getAll: () => [],
    set: () => {},
  })),
}))

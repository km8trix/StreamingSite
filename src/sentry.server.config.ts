import * as Sentry from '@sentry/nextjs'

// Sentry — Node.js server runtime. Imported by src/instrumentation.ts register().
// No DSN in env => the SDK initializes disabled (no events sent), so this is a
// safe no-op until SENTRY_DSN / NEXT_PUBLIC_SENTRY_DSN is set in the environment.
Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
  sendDefaultPii: true,
  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,
  includeLocalVariables: true,
  enableLogs: true,
})

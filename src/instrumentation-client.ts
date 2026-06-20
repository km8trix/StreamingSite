import * as Sentry from '@sentry/nextjs'

// Sentry — browser runtime. Next.js auto-loads this on the client. No DSN =>
// disabled no-op until NEXT_PUBLIC_SENTRY_DSN is set. Session Replay masks all
// text + blocks media by default; review against the privacy/GDPR policy (M5)
// before enabling a DSN in production.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  sendDefaultPii: true,
  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  enableLogs: true,
  integrations: [Sentry.replayIntegration()],
})

// Instruments client-side navigations (App Router) for tracing.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart

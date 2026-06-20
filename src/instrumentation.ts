import * as Sentry from '@sentry/nextjs'

// Next.js server instrumentation. register() runs once per server runtime at
// startup and loads the matching Sentry init. onRequestError forwards uncaught
// errors from Server Components / route handlers / actions to Sentry.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

export const onRequestError = Sentry.captureRequestError

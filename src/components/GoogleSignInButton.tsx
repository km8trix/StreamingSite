'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AuthResult } from '@/lib/auth/actions'
import type { AuthAction } from './AuthForm'

/**
 * GoogleSignInButton — "Continue with Google" submit, wrapped in a form that
 * posts to a `signInWithGoogle`-backed server action (passed as `action`, in the
 * useActionState shape `(prevState, formData) => Promise<AuthResult>`). The
 * action calls supabase.auth.signInWithOAuth() and redirect()s the browser to
 * Google; on return /auth/callback finishes the session. Progressive
 * enhancement: it's a real form submit, so it works even before hydration.
 *
 * On the happy path the action redirect()s (never returns), so `state.error` is
 * only ever set when Supabase can't START the flow (e.g. the Google provider is
 * disabled) — we surface that inline rather than failing silently.
 *
 * `next` (when provided) is forwarded as a hidden field so the user returns to
 * where they started after authenticating; the action + callback sanitize it.
 */
export function GoogleSignInButton({
  action,
  next,
  label = 'Continue with Google',
}: {
  action: AuthAction
  next?: string
  label?: string
}) {
  const [state, formAction] = useActionState<AuthResult, FormData>(action, {})

  return (
    <div className="flex flex-col gap-3">
      <form action={formAction}>
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <GoogleSubmit label={label} />
      </form>
      {state.error && (
        <p
          role="alert"
          data-testid="google-error"
          className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300"
        >
          {state.error}
        </p>
      )}
    </div>
  )
}

function GoogleSubmit({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      data-testid="google-signin"
      className={cn(
        'inline-flex w-full items-center justify-center gap-3 rounded-full border border-border-strong bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition-all',
        'hover:border-accent/60 hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-background',
        'disabled:cursor-not-allowed disabled:opacity-70',
      )}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        <GoogleGlyph className="size-4" />
      )}
      {label}
    </button>
  )
}

/** Google "G" mark (official 4-color), inlined so it renders without a network
 *  request and keeps its brand colors regardless of theme. */
function GoogleGlyph({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      focusable="false"
    >
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  )
}

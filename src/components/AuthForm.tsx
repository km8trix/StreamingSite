'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AuthResult } from '@/lib/auth/actions'

type Mode = 'signin' | 'signup'

/**
 * A server action compatible with useActionState: takes the previous state and
 * the submitted FormData, returns `{ error? }`. On success the underlying auth
 * action calls redirect(), so this only ever resolves with an error (the
 * redirect short-circuits the return).
 */
export type AuthAction = (
  prevState: AuthResult,
  formData: FormData,
) => Promise<AuthResult>

/**
 * AuthForm — accessible email/password (+username on signup) form that drives
 * the signin/signup server actions via useActionState and renders inline errors.
 * Client component: it owns the action state and the pending UI.
 */
export function AuthForm({
  mode,
  action,
}: {
  mode: Mode
  action: AuthAction
}) {
  const isSignup = mode === 'signup'
  const [state, formAction] = useActionState<AuthResult, FormData>(action, {})

  return (
    <form
      action={formAction}
      data-testid={isSignup ? 'signup-form' : 'signin-form'}
      className="flex flex-col gap-5"
      noValidate
    >
      <Field
        id="email"
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        testId="email-input"
        placeholder="you@example.com"
        required
      />

      {isSignup && (
        <Field
          id="username"
          name="username"
          label="Username"
          type="text"
          autoComplete="username"
          testId="username-input"
          placeholder="3–30 letters, numbers, underscores"
          hint="Optional — we'll generate one from your email if you skip it."
          pattern="[a-zA-Z0-9_]{3,30}"
        />
      )}

      <Field
        id="password"
        name="password"
        label="Password"
        type="password"
        autoComplete={isSignup ? 'new-password' : 'current-password'}
        testId="password-input"
        placeholder="••••••••"
        hint={isSignup ? 'At least 6 characters.' : undefined}
        minLength={isSignup ? 6 : undefined}
        required
      />

      {state.error && (
        <p
          role="alert"
          data-testid="auth-error"
          className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300"
        >
          {state.error}
        </p>
      )}

      <SubmitButton label={isSignup ? 'Create account' : 'Sign in'} />

      <p className="text-center text-sm text-muted">
        {isSignup ? (
          <>
            Already have an account?{' '}
            <Link
              href="/signin"
              className="font-medium text-accent-strong hover:underline"
            >
              Sign in
            </Link>
          </>
        ) : (
          <>
            New here?{' '}
            <Link
              href="/signup"
              className="font-medium text-accent-strong hover:underline"
            >
              Create an account
            </Link>
          </>
        )}
      </p>
    </form>
  )
}

function Field({
  id,
  name,
  label,
  type,
  testId,
  autoComplete,
  placeholder,
  hint,
  required,
  minLength,
  pattern,
}: {
  id: string
  name: string
  label: string
  type: string
  testId: string
  autoComplete?: string
  placeholder?: string
  hint?: string
  required?: boolean
  minLength?: number
  pattern?: string
}) {
  const hintId = hint ? `${id}-hint` : undefined
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
        {!required && (
          <span className="ml-1 text-xs font-normal text-subtle">(optional)</span>
        )}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        required={required}
        minLength={minLength}
        pattern={pattern}
        autoComplete={autoComplete}
        placeholder={placeholder}
        data-testid={testId}
        aria-describedby={hintId}
        className="rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-subtle transition-colors hover:border-border-strong focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-background"
      />
      {hint && (
        <p id={hintId} className="text-xs text-subtle">
          {hint}
        </p>
      )}
    </div>
  )
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      data-testid="auth-submit"
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition-all',
        'hover:bg-accent-strong hover:shadow-[0_8px_24px_-8px_rgba(139,92,246,0.7)]',
        'disabled:cursor-not-allowed disabled:opacity-70',
      )}
    >
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {label}
    </button>
  )
}

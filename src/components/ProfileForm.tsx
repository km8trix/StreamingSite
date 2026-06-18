'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Loader2 } from 'lucide-react'
import { updateProfile } from '@/lib/auth/actions'
import { cn } from '@/lib/utils'

type FormState = { error?: string; success?: boolean }

const initialState: FormState = {}

/**
 * updateProfile(FormData) returns `{ error? }` and does NOT redirect on success
 * (it returns `{}` so the page re-renders in place). We wrap it for
 * useActionState and flip a `success` flag when no error comes back, so the form
 * can confirm the save inline.
 */
async function action(_prev: FormState, formData: FormData): Promise<FormState> {
  const result = await updateProfile(formData)
  if (result.error) return { error: result.error }
  return { success: true }
}

/**
 * ProfileForm — edits the signed-in user's username, display name, and avatar
 * URL via the updateProfile server action. Client component (owns action state +
 * inline success/error). The username field IS editable and is submitted with
 * the form; updateProfile validates it (3–30 chars, [a-zA-Z0-9_]) and maps a
 * unique-violation to "username already taken".
 */
export function ProfileForm({
  username,
  displayName,
  avatarUrl,
}: {
  username: string
  displayName: string
  avatarUrl: string
}) {
  const [state, formAction] = useActionState(action, initialState)

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="username"
          className="text-sm font-medium text-foreground"
        >
          Username
        </label>
        <input
          id="username"
          name="username"
          type="text"
          defaultValue={username}
          autoComplete="username"
          pattern="[a-zA-Z0-9_]{3,30}"
          data-testid="profile-username"
          placeholder="3–30 letters, numbers, or underscores"
          aria-describedby="username-hint"
          className="rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-subtle transition-colors hover:border-border-strong focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-background"
        />
        <p id="username-hint" className="text-xs text-subtle">
          Your unique handle, shown as @{username || 'name'}.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="displayName"
          className="text-sm font-medium text-foreground"
        >
          Display name
        </label>
        <input
          id="displayName"
          name="displayName"
          type="text"
          defaultValue={displayName}
          maxLength={80}
          autoComplete="name"
          data-testid="profile-display-name"
          placeholder="How your name appears on comments & posts"
          className="rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-subtle transition-colors hover:border-border-strong focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-background"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="avatarUrl"
          className="text-sm font-medium text-foreground"
        >
          Avatar URL
        </label>
        <input
          id="avatarUrl"
          name="avatarUrl"
          type="url"
          defaultValue={avatarUrl}
          autoComplete="off"
          data-testid="profile-avatar-url"
          placeholder="https://…"
          aria-describedby="avatarUrl-hint"
          className="rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-subtle transition-colors hover:border-border-strong focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-background"
        />
        <p id="avatarUrl-hint" className="text-xs text-subtle">
          Paste a link to an image. Leave blank to use your initial.
        </p>
      </div>

      {state.error && (
        <p
          role="alert"
          data-testid="profile-error"
          className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300"
        >
          {state.error}
        </p>
      )}

      {state.success && !state.error && (
        <p
          role="status"
          data-testid="profile-success"
          className="rounded-lg border border-airing/40 bg-airing/10 px-3 py-2 text-sm text-airing"
        >
          Profile updated.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <SaveButton />
        {/* Cancel: close the profile page (discards any unsaved edits). */}
        <Link
          href="/"
          data-testid="profile-cancel"
          className="inline-flex w-fit items-center justify-center rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-muted transition-colors hover:bg-card-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Cancel
        </Link>
      </div>
    </form>
  )
}

function SaveButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      data-testid="profile-save"
      className={cn(
        'inline-flex w-fit items-center justify-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground transition-all',
        'hover:bg-accent-strong hover:shadow-[0_8px_24px_-8px_rgba(139,92,246,0.7)]',
        'disabled:cursor-not-allowed disabled:opacity-70',
      )}
    >
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      Save changes
    </button>
  )
}

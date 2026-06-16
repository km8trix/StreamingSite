'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, X } from 'lucide-react'
import { createThread } from '@/lib/forum/actions'
import { cn } from '@/lib/utils'

const MAX_TITLE_LENGTH = 200
const MAX_BODY_LENGTH = 10000

type FormState = { error?: string }

const initialState: FormState = {}

/**
 * NewThreadForm — auth-gated "start a thread" affordance for a category page.
 *
 * Client component: a "New thread" button toggles a composer (title + body).
 * Submitting calls the `createThread` server action (user_id is taken from the
 * session server-side — never sent from here). On success the action returns the
 * new thread id and we navigate to it. Inline error + pending UI via
 * useActionState / useFormStatus, mirroring the comments composer.
 *
 * Only rendered when the viewer is signed in; signed-out visitors get a
 * sign-in prompt from the parent page instead.
 */
export function NewThreadForm({ categoryId }: { categoryId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const [state, formAction] = useActionState<FormState, FormData>(
    async (_prev, formData) => {
      const title = String(formData.get('title') ?? '')
      const body = String(formData.get('body') ?? '')
      const result = await createThread(categoryId, title, body)
      if (result.error) return { error: result.error }
      if (result.threadId) {
        router.push(`/forum/thread/${result.threadId}`)
      }
      return {}
    },
    initialState,
  )

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="new-thread-button"
        className={cn(
          'inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition-all',
          'hover:bg-accent-strong hover:shadow-[0_8px_24px_-8px_rgba(139,92,246,0.7)]',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-background',
        )}
      >
        <Plus className="size-4" aria-hidden />
        New thread
      </button>
    )
  }

  return (
    <form
      action={formAction}
      data-testid="new-thread-form"
      className="flex flex-col gap-3 rounded-2xl border border-border bg-surface/60 p-4 shadow-xl sm:p-5"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-foreground">Start a new thread</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Cancel new thread"
          className="rounded-full p-1 text-subtle transition-colors hover:bg-card hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-background"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="thread-title-input"
          className="text-xs font-medium text-muted"
        >
          Title
        </label>
        <input
          id="thread-title-input"
          name="title"
          type="text"
          required
          maxLength={MAX_TITLE_LENGTH}
          placeholder="What do you want to discuss?"
          data-testid="thread-title-input"
          className={cn(
            'w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-subtle transition-colors',
            'hover:border-border-strong focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-background',
          )}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="thread-body-input"
          className="text-xs font-medium text-muted"
        >
          Message
        </label>
        <textarea
          id="thread-body-input"
          name="body"
          required
          maxLength={MAX_BODY_LENGTH}
          rows={5}
          placeholder="Share the details…"
          data-testid="thread-body-input"
          className={cn(
            'w-full resize-y rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-subtle transition-colors',
            'hover:border-border-strong focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-background',
          )}
        />
      </div>

      {state.error && (
        <p
          role="alert"
          data-testid="new-thread-error"
          className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300"
        >
          {state.error}
        </p>
      )}

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-full border border-border px-4 py-2 text-sm font-medium text-muted transition-colors hover:border-border-strong hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-background"
        >
          Cancel
        </button>
        <SubmitButton />
      </div>
    </form>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      data-testid="new-thread-submit"
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition-all',
        'hover:bg-accent-strong hover:shadow-[0_8px_24px_-8px_rgba(139,92,246,0.7)]',
        'disabled:cursor-not-allowed disabled:opacity-70',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-background',
      )}
    >
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      Create thread
    </button>
  )
}

'use client'

import { useActionState, useEffect, useRef } from 'react'
import { useFormStatus } from 'react-dom'
import { Loader2, Send } from 'lucide-react'
import { replyToThread } from '@/lib/forum/actions'
import { cn } from '@/lib/utils'

const MAX_BODY_LENGTH = 10000

type FormState = { error?: string; ok?: boolean }

const initialState: FormState = {}

/**
 * ReplyComposer — the reply form at the bottom of a thread page.
 *
 * Client component owning inline error + pending UI (useActionState /
 * useFormStatus), mirroring the comments composer. The body is the only field
 * the user controls; the thread id is bound from props and the author is taken
 * from the session server-side in the action. On a successful reply the textarea
 * clears; the action revalidates the thread so the post appears on next render.
 *
 * Locked threads are handled by the parent (it renders a notice instead of this
 * composer for non-moderators), but the action also rejects a locked reply,
 * which surfaces here as the inline error.
 */
export function ReplyComposer({ threadId }: { threadId: string }) {
  const formRef = useRef<HTMLFormElement>(null)

  const [state, formAction] = useActionState<FormState, FormData>(
    async (_prev, formData) => {
      const body = String(formData.get('body') ?? '')
      const result = await replyToThread(threadId, body)
      if (result.error) return { error: result.error }
      return { ok: true }
    },
    initialState,
  )

  useEffect(() => {
    if (state.ok) formRef.current?.reset()
  }, [state])

  return (
    <form
      ref={formRef}
      action={formAction}
      data-testid="reply-composer"
      className="flex flex-col gap-2"
    >
      <label htmlFor="reply-body-input" className="sr-only">
        Write a reply
      </label>
      <textarea
        id="reply-body-input"
        name="body"
        required
        maxLength={MAX_BODY_LENGTH}
        rows={3}
        placeholder="Write a reply…"
        data-testid="reply-body-input"
        className={cn(
          'w-full resize-y rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-subtle transition-colors',
          'hover:border-border-strong focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-background',
        )}
      />

      {state.error && (
        <p
          role="alert"
          data-testid="reply-error"
          className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300"
        >
          {state.error}
        </p>
      )}

      <div className="flex items-center justify-end">
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
      data-testid="reply-submit"
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition-all',
        'hover:bg-accent-strong hover:shadow-[0_8px_24px_-8px_rgba(139,92,246,0.7)]',
        'disabled:cursor-not-allowed disabled:opacity-70',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-background',
      )}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        <Send className="size-4" aria-hidden />
      )}
      Reply
    </button>
  )
}

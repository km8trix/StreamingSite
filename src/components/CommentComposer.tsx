'use client'

import { useActionState, useEffect, useRef } from 'react'
import { useFormStatus } from 'react-dom'
import { Loader2, Send } from 'lucide-react'
import { addComment } from '@/lib/comments/actions'
import { cn } from '@/lib/utils'

const MAX_BODY_LENGTH = 4000

type FormState = { error?: string; ok?: boolean }

const initialState: FormState = {}

/**
 * CommentComposer — the form for posting a top-level comment or a reply.
 *
 * Client component: it owns the action state (inline error) and the pending UI
 * via useActionState + useFormStatus. The body is the only field the user
 * controls; showId/parentId are passed as props and bound server-side. The
 * author is always taken from the session in the action (never sent from here).
 *
 * On a successful post the textarea is cleared and `onPosted` runs (used by a
 * reply composer to collapse itself). Revalidation happens in the action, so the
 * new comment appears on the next server render.
 */
export function CommentComposer({
  showId,
  parentId,
  placeholder,
  submitLabel = 'Post comment',
  autoFocus = false,
  onPosted,
  compact = false,
}: {
  showId: string
  parentId?: string
  placeholder?: string
  submitLabel?: string
  autoFocus?: boolean
  onPosted?: () => void
  compact?: boolean
}) {
  const formRef = useRef<HTMLFormElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const [state, formAction] = useActionState<FormState, FormData>(
    async (_prev, formData) => {
      const body = String(formData.get('body') ?? '')
      const result = await addComment(showId, body, parentId)
      if (result.error) return { error: result.error }
      return { ok: true }
    },
    initialState,
  )

  // After a successful post, clear the field and notify the parent (e.g. to
  // collapse a reply composer). Keyed on `state.ok` identity per submission.
  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset()
      onPosted?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run only on a new successful post
  }, [state])

  useEffect(() => {
    if (autoFocus) textareaRef.current?.focus()
  }, [autoFocus])

  return (
    <form
      ref={formRef}
      action={formAction}
      data-testid="comment-composer"
      className="flex flex-col gap-2"
    >
      <label htmlFor={parentId ? `reply-body-${parentId}` : 'comment-body-input'} className="sr-only">
        {placeholder ?? 'Write a comment'}
      </label>
      <textarea
        ref={textareaRef}
        id={parentId ? `reply-body-${parentId}` : 'comment-body-input'}
        name="body"
        required
        maxLength={MAX_BODY_LENGTH}
        rows={compact ? 2 : 3}
        placeholder={placeholder ?? 'Share your thoughts on this show…'}
        className={cn(
          'w-full resize-y rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-subtle transition-colors',
          'hover:border-border-strong focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-background',
        )}
      />

      {state.error && (
        <p
          role="alert"
          data-testid="comment-error"
          className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300"
        >
          {state.error}
        </p>
      )}

      <div className="flex items-center justify-end gap-2">
        <SubmitButton label={submitLabel} />
      </div>
    </form>
  )
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      data-testid="comment-submit"
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition-all',
        'hover:bg-accent-strong hover:shadow-[0_8px_24px_-8px_rgba(139,92,246,0.7)]',
        'disabled:cursor-not-allowed disabled:opacity-70',
      )}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        <Send className="size-4" aria-hidden />
      )}
      {label}
    </button>
  )
}

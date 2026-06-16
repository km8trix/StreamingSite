'use client'

import { useActionState, useEffect, useRef } from 'react'
import { useFormStatus } from 'react-dom'
import { Loader2 } from 'lucide-react'
import { editPost } from '@/lib/forum/actions'
import { cn } from '@/lib/utils'

const MAX_BODY_LENGTH = 10000

type FormState = { error?: string; ok?: boolean }

const initialState: FormState = {}

/**
 * PostEditForm — inline editor for one of the signed-in user's own posts.
 * Submits the new body to the editPost action (sets is_edited; RLS-scoped to the
 * owner). On success it calls `onDone` to collapse the editor; the revalidated
 * render shows the updated text + an "(edited)" marker. Mirrors CommentEditForm.
 */
export function PostEditForm({
  postId,
  initialBody,
  onCancel,
  onDone,
}: {
  postId: string
  initialBody: string
  onCancel: () => void
  onDone: () => void
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const [state, formAction] = useActionState<FormState, FormData>(
    async (_prev, formData) => {
      const body = String(formData.get('body') ?? '')
      const result = await editPost(postId, body)
      if (result.error) return { error: result.error }
      return { ok: true }
    },
    initialState,
  )

  useEffect(() => {
    const el = textareaRef.current
    if (el) {
      el.focus()
      el.setSelectionRange(el.value.length, el.value.length)
    }
  }, [])

  useEffect(() => {
    if (state.ok) onDone()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run only on a successful edit
  }, [state])

  return (
    <form action={formAction} className="mt-2 flex flex-col gap-2">
      <label htmlFor={`edit-post-${postId}`} className="sr-only">
        Edit your post
      </label>
      <textarea
        ref={textareaRef}
        id={`edit-post-${postId}`}
        name="body"
        required
        maxLength={MAX_BODY_LENGTH}
        rows={4}
        defaultValue={initialBody}
        data-testid="post-edit-input"
        className={cn(
          'w-full resize-y rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-subtle transition-colors',
          'hover:border-border-strong focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-background',
        )}
      />

      {state.error && (
        <p
          role="alert"
          data-testid="post-error"
          className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300"
        >
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-2">
        <SaveButton />
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-border-strong hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-background"
        >
          Cancel
        </button>
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
      data-testid="post-edit-save"
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground transition-all',
        'hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-70',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-background',
      )}
    >
      {pending && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
      Save
    </button>
  )
}

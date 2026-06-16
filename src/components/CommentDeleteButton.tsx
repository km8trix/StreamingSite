'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Loader2, Trash2 } from 'lucide-react'
import { deleteComment } from '@/lib/comments/actions'
import { cn } from '@/lib/utils'

type FormState = { error?: string }

const initialState: FormState = {}

/**
 * CommentDeleteButton — soft-deletes one of the signed-in user's own comments via
 * the deleteComment action (RLS-scoped to the owner). Two-step to avoid an
 * accidental destructive click: the first click reveals a "Confirm" / "Cancel"
 * pair; confirming submits the action. The revalidated render replaces the body
 * with "[deleted]".
 */
export function CommentDeleteButton({ commentId }: { commentId: string }) {
  const [confirming, setConfirming] = useState(false)
  const [state, formAction] = useActionState<FormState, FormData>(
    async () => {
      const result = await deleteComment(commentId)
      if (result.error) return { error: result.error }
      return {}
    },
    initialState,
  )

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        data-testid="comment-delete"
        className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-subtle transition-colors hover:bg-red-500/10 hover:text-red-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-background"
      >
        <Trash2 className="size-3.5" aria-hidden />
        Delete
      </button>
    )
  }

  return (
    <form action={formAction} className="inline-flex items-center gap-1.5">
      <span className="text-xs text-muted">Delete?</span>
      <ConfirmButton />
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="rounded-full px-2 py-1 text-xs font-medium text-subtle transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-background"
      >
        Cancel
      </button>
      {state.error && (
        <span role="alert" className="text-xs text-red-300">
          {state.error}
        </span>
      )}
    </form>
  )
}

function ConfirmButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      data-testid="comment-delete-confirm"
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-red-500/90 px-2.5 py-1 text-xs font-semibold text-white transition-colors',
        'hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-70',
      )}
    >
      {pending && <Loader2 className="size-3 animate-spin" aria-hidden />}
      Confirm
    </button>
  )
}

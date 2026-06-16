'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Loader2, Trash2 } from 'lucide-react'
import { deletePost } from '@/lib/forum/actions'
import { cn } from '@/lib/utils'

type FormState = { error?: string }

const initialState: FormState = {}

/**
 * PostDeleteButton — soft-deletes a post via the deletePost action. Allowed for
 * the post's owner OR a moderator (the DB RLS policy gates both); the action does
 * not scope by user_id so a moderator can delete any post. Two-step confirm to
 * avoid an accidental destructive click. The revalidated render replaces the body
 * with "[deleted]". Mirrors CommentDeleteButton.
 */
export function PostDeleteButton({ postId }: { postId: string }) {
  const [confirming, setConfirming] = useState(false)
  const [state, formAction] = useActionState<FormState, FormData>(
    async () => {
      const result = await deletePost(postId)
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
        data-testid="post-delete"
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
      data-testid="post-delete-confirm"
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-red-500/90 px-2.5 py-1 text-xs font-semibold text-white transition-colors',
        'hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-70',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-background',
      )}
    >
      {pending && <Loader2 className="size-3 animate-spin" aria-hidden />}
      Confirm
    </button>
  )
}

'use client'

import { useState, useTransition } from 'react'
import { Lock, LockOpen, Loader2, Pin, PinOff, ShieldCheck } from 'lucide-react'
import { lockThread, pinThread } from '@/lib/forum/actions'
import { cn } from '@/lib/utils'

/**
 * ThreadModControls — moderator-only Pin / Lock toggles for a thread. Rendered by
 * the thread page ONLY when the viewer's role is moderator/admin (resolved
 * server-side); the actions themselves re-check the role and RLS is the
 * authoritative guard, so this is purely the UI affordance.
 *
 * Each toggle calls the corresponding server action with the NEXT state and
 * relies on the action's revalidation to re-render the page with the new state.
 */
export function ThreadModControls({
  threadId,
  isPinned,
  isLocked,
}: {
  threadId: string
  isPinned: boolean
  isLocked: boolean
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function togglePin() {
    setError(null)
    startTransition(async () => {
      const result = await pinThread(threadId, !isPinned)
      if (result.error) setError(result.error)
    })
  }

  function toggleLock() {
    setError(null)
    startTransition(async () => {
      const result = await lockThread(threadId, !isLocked)
      if (result.error) setError(result.error)
    })
  }

  return (
    <div
      className="flex flex-col gap-2 rounded-2xl border border-accent/30 bg-accent/5 p-3"
      role="group"
      aria-label="Moderator actions"
    >
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-accent-strong">
        <ShieldCheck className="size-3.5" aria-hidden />
        Moderator
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <ModButton
          onClick={togglePin}
          pending={pending}
          active={isPinned}
          testid="mod-pin"
          label={isPinned ? 'Unpin' : 'Pin'}
          icon={isPinned ? <PinOff className="size-3.5" aria-hidden /> : <Pin className="size-3.5" aria-hidden />}
        />
        <ModButton
          onClick={toggleLock}
          pending={pending}
          active={isLocked}
          testid="mod-lock"
          label={isLocked ? 'Unlock' : 'Lock'}
          icon={isLocked ? <LockOpen className="size-3.5" aria-hidden /> : <Lock className="size-3.5" aria-hidden />}
        />
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-300">
          {error}
        </p>
      )}
    </div>
  )
}

function ModButton({
  onClick,
  pending,
  active,
  testid,
  label,
  icon,
}: {
  onClick: () => void
  pending: boolean
  active: boolean
  testid: string
  label: string
  icon: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-pressed={active}
      data-testid={testid}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-background',
        'disabled:cursor-not-allowed disabled:opacity-70',
        active
          ? 'border-accent bg-accent/20 text-accent-strong'
          : 'border-border bg-surface text-muted hover:border-border-strong hover:text-foreground',
      )}
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : icon}
      {label}
    </button>
  )
}

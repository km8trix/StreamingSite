'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Shuffle } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * RandomizeButton — sends the user to a random show via the /random route
 * handler (which redirects to /shows/[slug]). Client component only for the
 * pending state flourish; the underlying action is a plain navigation, so it
 * still works without JS as a link fallback is provided.
 */
export function RandomizeButton({
  className,
  variant = 'solid',
  label = 'Randomize',
}: {
  className?: string
  variant?: 'solid' | 'outline'
  label?: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  return (
    <a
      href="/random"
      onClick={(e) => {
        // Progressive enhancement: intercept for the pending state, but the
        // href keeps it working if JS is disabled.
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
        e.preventDefault()
        startTransition(() => router.push('/random'))
      }}
      aria-busy={isPending}
      data-testid="randomize-button"
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all',
        variant === 'solid'
          ? 'bg-accent text-accent-foreground hover:bg-accent-strong hover:shadow-[0_8px_24px_-8px_rgba(139,92,246,0.7)]'
          : 'border border-border-strong bg-surface text-foreground hover:border-accent/60 hover:text-accent-strong',
        isPending && 'opacity-80',
        className,
      )}
    >
      <Shuffle
        className={cn('size-4', isPending && 'animate-spin')}
        aria-hidden
      />
      {label}
    </a>
  )
}

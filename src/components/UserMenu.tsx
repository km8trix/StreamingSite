'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, LogOut, User as UserIcon } from 'lucide-react'
import { signOutForm } from '@/lib/auth/form-actions'
import { UserAvatar } from './UserAvatar'
import { cn } from '@/lib/utils'

/**
 * UserMenu — signed-in header control: an avatar/username button that toggles a
 * dropdown with "Profile" and "Sign out". Client component (open/close state,
 * outside-click + Escape handling). Sign out is a server action submitted via a
 * <form> so it works without extra client plumbing.
 *
 * Receives only plain profile fields (label + avatar) from the server header —
 * never the raw Supabase session.
 */
export function UserMenu({
  label,
  avatarUrl,
}: {
  label: string
  avatarUrl: string | null
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const firstItemRef = useRef<HTMLAnchorElement>(null)

  useEffect(() => {
    if (!open) return

    function onPointerDown(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      // Escape closes and returns focus to the trigger (menu a11y expectation).
      if (e.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  // When the menu opens, move focus to the first item so keyboard users land
  // inside the menu rather than having to tab into it.
  useEffect(() => {
    if (open) firstItemRef.current?.focus()
  }, [open])

  return (
    <div ref={containerRef} className="relative" data-testid="header-user-menu">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          'flex items-center gap-2 rounded-full border border-border bg-card/60 py-1 pl-1 pr-2.5 text-sm font-medium text-foreground transition-colors',
          'hover:border-border-strong hover:bg-card',
        )}
      >
        <UserAvatar avatarUrl={avatarUrl} name={label} size={28} />
        <span className="hidden max-w-[8rem] truncate sm:inline">{label}</span>
        <ChevronDown
          className={cn(
            'size-4 text-subtle transition-transform',
            open && 'rotate-180',
          )}
          aria-hidden
        />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Account"
          className="absolute right-0 z-50 mt-2 w-48 overflow-hidden rounded-xl border border-border bg-surface shadow-2xl"
        >
          <div className="border-b border-border px-3 py-2.5">
            <p className="truncate text-sm font-semibold text-foreground">
              {label}
            </p>
            <p className="text-xs text-subtle">Signed in</p>
          </div>

          <Link
            href="/profile"
            ref={firstItemRef}
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2.5 text-sm text-muted transition-colors hover:bg-card hover:text-foreground"
          >
            <UserIcon className="size-4" aria-hidden />
            Profile
          </Link>

          <form action={signOutForm}>
            <button
              type="submit"
              role="menuitem"
              data-testid="signout-button"
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-muted transition-colors hover:bg-card hover:text-foreground"
            >
              <LogOut className="size-4" aria-hidden />
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

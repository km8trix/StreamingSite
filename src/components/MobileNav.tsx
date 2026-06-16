'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'

// Same routes as the desktop <nav> in SiteHeader. Kept here so the mobile menu
// stays a single self-contained client island.
const NAV_ITEMS = [
  { href: '/', label: 'Home', exact: true },
  { href: '/shows', label: 'Browse', exact: false },
  { href: '/schedule', label: 'Schedule', exact: false },
  { href: '/forum', label: 'Forum', exact: false },
] as const

/**
 * MobileNav — hamburger button + dropdown panel exposing the primary nav on
 * viewports below md, where SiteHeader's inline <nav> is `hidden md:flex`.
 * Client component: open/close state, outside-click + Escape (mirrors UserMenu),
 * and active-route highlighting (mirrors NavLink). The whole island is
 * `md:hidden`, so on >=md it leaves the a11y tree and the desktop nav is the
 * only "Primary" landmark.
 */
export function MobileNav() {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const firstLinkRef = useRef<HTMLAnchorElement>(null)
  const pathname = usePathname()

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

  // When the panel opens, move focus to the first item so keyboard users land
  // inside the menu rather than having to tab into it.
  useEffect(() => {
    if (open) firstLinkRef.current?.focus()
  }, [open])

  return (
    <div ref={containerRef} className="relative md:hidden" data-testid="mobile-nav">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={open ? 'Close menu' : 'Open menu'}
        className={cn(
          'grid size-9 place-items-center rounded-full border border-border bg-card/60 text-foreground transition-colors',
          'hover:border-border-strong hover:bg-card',
        )}
      >
        {open ? (
          <X className="size-5" aria-hidden />
        ) : (
          <Menu className="size-5" aria-hidden />
        )}
      </button>

      {open && (
        <nav
          aria-label="Primary"
          className="absolute left-0 z-50 mt-2 w-48 overflow-hidden rounded-xl border border-border bg-surface shadow-2xl"
        >
          {NAV_ITEMS.map((item, index) => {
            const active = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                ref={index === 0 ? firstLinkRef : undefined}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                onClick={() => setOpen(false)}
                className={cn(
                  'block px-4 py-2.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-accent/15 text-accent-strong'
                    : 'text-muted hover:bg-card hover:text-foreground',
                )}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
      )}
    </div>
  )
}

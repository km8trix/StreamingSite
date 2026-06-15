'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

/**
 * NavLink — header nav item with active-route highlighting. Client component
 * (needs usePathname); kept tiny so the rest of the header stays server-side.
 */
export function NavLink({
  href,
  children,
  exact = false,
}: {
  href: string
  children: React.ReactNode
  exact?: boolean
}) {
  const pathname = usePathname()
  const active = exact ? pathname === href : pathname.startsWith(href)

  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
        active
          ? 'bg-accent/15 text-accent-strong'
          : 'text-muted hover:bg-card hover:text-foreground',
      )}
    >
      {children}
    </Link>
  )
}

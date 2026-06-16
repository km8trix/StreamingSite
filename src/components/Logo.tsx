import Link from 'next/link'
import { Tv } from 'lucide-react'

/**
 * Logo / wordmark — links home.
 */
export function Logo() {
  return (
    <Link
      href="/"
      className="flex items-center gap-2 font-bold tracking-tight"
      aria-label="Senpai — home"
    >
      <span className="grid size-8 place-items-center rounded-lg bg-accent text-accent-foreground shadow-[0_4px_16px_-4px_rgba(139,92,246,0.7)]">
        <Tv className="size-5" aria-hidden />
      </span>
      <span className="text-lg">
        <span className="text-foreground">Senp</span>
        <span className="text-accent-strong">ai</span>
      </span>
    </Link>
  )
}

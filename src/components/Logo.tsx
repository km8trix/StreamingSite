import Link from 'next/link'

/**
 * Cool-S mark — the canonical "graffiti S" (Wikimedia S-cool.svg): one open
 * path drawn twice, the second copy rotated 180° about the figure's centre
 * (3,6). Rendered as two <path>s rather than <use href> so multiple Logos on a
 * page (header + footer) don't collide on a shared element id.
 */
function CoolS({ className }: { className?: string }) {
  const d = 'M3 9V7L1 5V3L3 1 5 3V5L4 6'
  return (
    <svg
      viewBox="0.5 0.5 5 11"
      fill="none"
      stroke="currentColor"
      strokeWidth={0.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d={d} />
      <g transform="rotate(180 3 6)">
        <path d={d} />
      </g>
    </svg>
  )
}

/**
 * Logo / wordmark — links home. The Cool-S sits in the brand violet badge.
 */
export function Logo() {
  return (
    <Link
      href="/"
      className="flex items-center gap-2.5 font-bold tracking-tight"
      aria-label="Senpai — home"
    >
      <span className="grid size-9 place-items-center rounded-xl bg-accent text-accent-foreground shadow-[0_6px_20px_-6px_rgba(139,92,246,0.8)]">
        <CoolS className="h-5 w-auto" />
      </span>
      <span className="text-lg">
        <span className="text-foreground">Senp</span>
        <span className="text-accent-strong">ai</span>
      </span>
    </Link>
  )
}

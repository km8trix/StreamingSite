import { cn } from '@/lib/utils'

/**
 * UserAvatar — circular avatar. Renders the avatar image when a (validly-hosted)
 * URL is present, otherwise a violet initial chip derived from the display name
 * / username / email. Server-safe (no client hooks).
 *
 * Note: next/image only allows allowlisted remote hosts (next.config.ts). To
 * avoid a build/runtime error on an arbitrary user-supplied avatar URL, we use a
 * plain <img> here — these are small, user-chosen, and not worth the image
 * optimizer / host-allowlist coupling.
 */
export function UserAvatar({
  avatarUrl,
  name,
  size = 32,
  className,
}: {
  avatarUrl?: string | null
  name?: string | null
  size?: number
  className?: string
}) {
  const initial = (name?.trim()?.[0] ?? '?').toUpperCase()

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- user-supplied host, intentionally un-optimized
      <img
        src={avatarUrl}
        alt=""
        width={size}
        height={size}
        className={cn(
          'shrink-0 rounded-full border border-border object-cover',
          className,
        )}
        style={{ width: size, height: size }}
      />
    )
  }

  return (
    <span
      aria-hidden
      className={cn(
        'grid shrink-0 place-items-center rounded-full bg-accent/20 font-semibold text-accent-strong',
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.45 }}
    >
      {initial}
    </span>
  )
}

import Link from 'next/link'
import { getCurrentUser } from '@/lib/data'
import { UserMenu } from './UserMenu'

/**
 * AuthControls — server component that reads the auth session and renders the
 * right header control:
 *   - signed out  → a "Sign in" link (testid `signin-link`)
 *   - signed in   → the UserMenu (avatar + Profile / Sign out dropdown)
 *
 * Lives in the header so auth state is resolved server-side on every render.
 */
export async function AuthControls() {
  const user = await getCurrentUser()

  if (!user) {
    return (
      <Link
        href="/signin"
        data-testid="signin-link"
        className="inline-flex items-center rounded-full border border-border-strong bg-surface px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:border-accent/60 hover:text-accent-strong"
      >
        Sign in
      </Link>
    )
  }

  // Prefer display name, fall back to username, then email local-part.
  const label =
    user.profile?.displayName?.trim() ||
    user.profile?.username?.trim() ||
    user.email?.split('@')[0] ||
    'Account'

  return <UserMenu label={label} avatarUrl={user.profile?.avatarUrl ?? null} />
}

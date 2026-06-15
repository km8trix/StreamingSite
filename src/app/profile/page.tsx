import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/data'
import { UserAvatar } from '@/components/UserAvatar'
import { ProfileForm } from '@/components/ProfileForm'

export const metadata: Metadata = {
  title: 'Your profile',
  description: 'View and edit your Senpai profile.',
}

// Reads the session cookie — never prerender.
export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  const user = await getCurrentUser()

  // Auth gate: bounce signed-out visitors to sign in.
  if (!user) redirect('/signin')

  const { profile, email } = user
  const displayName = profile?.displayName ?? ''
  const username = profile?.username ?? null
  const avatarUrl = profile?.avatarUrl ?? ''
  const heading = displayName || username || email?.split('@')[0] || 'Your profile'

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8 flex items-center gap-4">
        <UserAvatar avatarUrl={avatarUrl || null} name={heading} size={64} />
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-extrabold tracking-tight text-foreground">
            {heading}
          </h1>
          <p className="mt-0.5 truncate text-sm text-muted">
            {username ? `@${username}` : 'No username yet'}
            {email ? ` · ${email}` : ''}
          </p>
          {profile?.role && profile.role !== 'user' && (
            <span className="mt-1 inline-block rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-accent-strong">
              {profile.role}
            </span>
          )}
        </div>
      </header>

      <section
        aria-labelledby="edit-profile-heading"
        className="rounded-2xl border border-border bg-surface/60 p-6 shadow-xl sm:p-8"
      >
        <h2
          id="edit-profile-heading"
          className="mb-1 text-lg font-bold text-foreground"
        >
          Edit profile
        </h2>
        <p className="mb-6 text-sm text-muted">
          Update how you appear across Senpai.
        </p>

        <ProfileForm
          username={username ?? ''}
          displayName={displayName}
          avatarUrl={avatarUrl}
        />
      </section>
    </div>
  )
}

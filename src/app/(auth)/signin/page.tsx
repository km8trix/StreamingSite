import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/data'
import { signIn, signInWithGoogle } from '@/lib/auth/actions'
import { AuthForm, type AuthAction } from '@/components/AuthForm'
import { GoogleSignInButton } from '@/components/GoogleSignInButton'
import { AuthDivider } from '@/components/AuthDivider'
import { safeRedirectPath } from '@/lib/auth/safe-redirect'

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to your Senpai account.',
}

// signIn(FormData) -> { error? }; adapt to the useActionState signature
// (prevState, formData). Marked 'use server' so it stays a server action when
// passed across the client boundary into AuthForm.
async function signInAction(
  _prev: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  'use server'
  return signIn(formData)
}

// Same useActionState adapter for the Google button. signInWithGoogle reads the
// hidden `next` field from formData; on success it redirect()s to Google.
async function googleAction(
  _prev: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  'use server'
  return signInWithGoogle(formData)
}

export default async function SignInPage({
  searchParams,
}: {
  // Next 16: searchParams is async.
  searchParams: Promise<{ error?: string | string[]; next?: string | string[] }>
}) {
  // Already signed in? No reason to show the form.
  const user = await getCurrentUser()
  if (user) redirect('/')

  const params = await searchParams
  const rawNext = Array.isArray(params.next) ? params.next[0] : params.next
  const next = safeRedirectPath(rawNext)
  const rawError = Array.isArray(params.error) ? params.error[0] : params.error
  // OAuth callback errors arrive as ?error=… — surface them so the user isn't
  // left wondering why they're back on the sign-in page.
  const oauthError = typeof rawError === 'string' ? rawError : null

  return (
    <div className="rounded-2xl border border-border bg-surface/60 p-6 shadow-xl sm:p-8">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
          Welcome back
        </h1>
        <p className="mt-1 text-sm text-muted">
          Sign in to comment, post in the forum, and manage your profile.
        </p>
      </div>

      {oauthError && (
        <p
          role="alert"
          data-testid="oauth-error"
          className="mb-5 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300"
        >
          {oauthError}
        </p>
      )}

      <GoogleSignInButton
        action={googleAction as AuthAction}
        next={next !== '/' ? next : undefined}
      />
      <AuthDivider />
      <AuthForm
        mode="signin"
        action={signInAction as AuthAction}
        next={next !== '/' ? next : undefined}
      />
    </div>
  )
}

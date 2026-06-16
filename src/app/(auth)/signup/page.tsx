import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/data'
import { signUp, signInWithGoogle } from '@/lib/auth/actions'
import { AuthForm, type AuthAction } from '@/components/AuthForm'
import { GoogleSignInButton } from '@/components/GoogleSignInButton'
import { AuthDivider } from '@/components/AuthDivider'

export const metadata: Metadata = {
  title: 'Create account',
  description: 'Create a Senpai account to comment and join the forum.',
}

// signUp(FormData) -> { error? }; adapt to the useActionState signature.
async function signUpAction(
  _prev: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  'use server'
  return signUp(formData)
}

// useActionState adapter for the Google button (OAuth creates the account on
// first use). On success signInWithGoogle redirect()s to Google.
async function googleAction(
  _prev: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  'use server'
  return signInWithGoogle(formData)
}

export default async function SignUpPage() {
  const user = await getCurrentUser()
  if (user) redirect('/')

  return (
    <div className="rounded-2xl border border-border bg-surface/60 p-6 shadow-xl sm:p-8">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
          Create your account
        </h1>
        <p className="mt-1 text-sm text-muted">
          Join Senpai to comment on shows and post in the forum.
        </p>
      </div>

      {/* OAuth has no separate sign-up; the same Google button creates the
          account on first use. */}
      <GoogleSignInButton
        action={googleAction as AuthAction}
        label="Sign up with Google"
      />
      <AuthDivider />
      <AuthForm mode="signup" action={signUpAction as AuthAction} />
    </div>
  )
}

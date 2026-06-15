import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/data'
import { signIn } from '@/lib/auth/actions'
import { AuthForm, type AuthAction } from '@/components/AuthForm'

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

export default async function SignInPage() {
  // Already signed in? No reason to show the form.
  const user = await getCurrentUser()
  if (user) redirect('/')

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
      <AuthForm mode="signin" action={signInAction as AuthAction} />
    </div>
  )
}

import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/data'
import { signUp } from '@/lib/auth/actions'
import { AuthForm, type AuthAction } from '@/components/AuthForm'

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
      <AuthForm mode="signup" action={signUpAction as AuthAction} />
    </div>
  )
}

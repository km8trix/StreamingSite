'use server'

// Thin `void`-returning wrappers around the auth actions, for use directly as
// <form action={…}> handlers (which require a `(formData) => void | Promise<void>`
// signature). The underlying actions redirect on success (so they don't actually
// return on the happy path); these wrappers just satisfy the form-action type and
// swallow the unused result.

import { signOut as signOutAction } from './actions'

export async function signOutForm(): Promise<void> {
  await signOutAction()
}

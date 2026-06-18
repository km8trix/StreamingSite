// ProfileForm.test.tsx — the edit form's Cancel affordance.

import { render, screen, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

// The server action is never invoked in these tests (no submit); stub it so the
// import graph (which reaches next/headers transitively) stays loadable.
vi.mock('@/lib/auth/actions', () => ({
  updateProfile: vi.fn(async () => ({})),
}))

import { ProfileForm } from './ProfileForm'

afterEach(cleanup)

describe('ProfileForm — cancel', () => {
  it('renders a Cancel link that closes the profile page (navigates home)', () => {
    render(<ProfileForm username="neo" displayName="Neo" avatarUrl="" />)

    const cancel = screen.getByTestId('profile-cancel')
    // It's a navigation link out of the page, not a form button.
    expect(cancel.tagName).toBe('A')
    expect(cancel).toHaveAttribute('href', '/')
    expect(cancel).toHaveTextContent('Cancel')
  })
})

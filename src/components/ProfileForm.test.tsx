// ProfileForm.test.tsx — the edit form's Cancel (reset) affordance.

import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

// The server action is never invoked in these tests (no submit); stub it so the
// import graph (which reaches next/headers transitively) stays loadable.
vi.mock('@/lib/auth/actions', () => ({
  updateProfile: vi.fn(async () => ({})),
}))

import { ProfileForm } from './ProfileForm'

afterEach(cleanup)

describe('ProfileForm — cancel', () => {
  it('renders a Cancel reset button that reverts edits to the saved values', () => {
    render(<ProfileForm username="neo" displayName="Neo" avatarUrl="" />)

    const displayName = screen.getByTestId(
      'profile-display-name',
    ) as HTMLInputElement
    expect(displayName.value).toBe('Neo')

    // Edit the field…
    fireEvent.change(displayName, { target: { value: 'Trinity' } })
    expect(displayName.value).toBe('Trinity')

    const cancel = screen.getByTestId('profile-cancel')
    expect(cancel).toHaveAttribute('type', 'reset')

    // …then Cancel reverts it to the original (native form reset → defaultValue).
    fireEvent.click(cancel)
    expect(displayName.value).toBe('Neo')
  })
})

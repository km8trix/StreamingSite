import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { UserMenu } from './UserMenu'

// signOutForm pulls the server-only auth chain (next/headers, supabase); the
// menu only renders it when open, but the import must resolve in jsdom.
vi.mock('@/lib/auth/form-actions', () => ({ signOutForm: async () => {} }))

describe('UserMenu', () => {
  it('gives the trigger a stable accessible name (the username span is hidden below sm)', () => {
    render(<UserMenu label="Spencer" avatarUrl={null} />)
    // Without the aria-label the button has no name on mobile (avatar is alt="",
    // chevron is aria-hidden). The name must include the username for WCAG 2.5.3.
    expect(
      screen.getByRole('button', { name: /spencer account menu/i }),
    ).toBeInTheDocument()
  })
})

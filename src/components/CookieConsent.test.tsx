import { render, screen, fireEvent } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CookieConsent } from './CookieConsent'

// Stand in for Vercel Analytics so we can assert it's mounted only on accept.
vi.mock('@vercel/analytics/next', () => ({
  Analytics: () => <div data-testid="analytics" />,
}))

const banner = () => screen.queryByRole('region', { name: /cookie consent/i })

describe('CookieConsent', () => {
  beforeEach(() => localStorage.clear())

  it('shows the banner and keeps analytics off when no choice is stored', () => {
    render(<CookieConsent />)
    expect(banner()).toBeInTheDocument()
    expect(screen.queryByTestId('analytics')).toBeNull()
  })

  it('accepting hides the banner, persists, and mounts analytics', () => {
    render(<CookieConsent />)
    fireEvent.click(screen.getByRole('button', { name: /accept/i }))
    expect(localStorage.getItem('cookie-consent')).toBe('accepted')
    expect(banner()).toBeNull()
    expect(screen.getByTestId('analytics')).toBeInTheDocument()
  })

  it('declining hides the banner, persists, and leaves analytics off', () => {
    render(<CookieConsent />)
    fireEvent.click(screen.getByRole('button', { name: /decline/i }))
    expect(localStorage.getItem('cookie-consent')).toBe('declined')
    expect(banner()).toBeNull()
    expect(screen.queryByTestId('analytics')).toBeNull()
  })

  it('does not re-show the banner once a choice exists', () => {
    localStorage.setItem('cookie-consent', 'declined')
    render(<CookieConsent />)
    expect(banner()).toBeNull()
    expect(screen.queryByTestId('analytics')).toBeNull()
  })
})

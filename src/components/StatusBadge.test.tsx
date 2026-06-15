import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StatusBadge } from './StatusBadge'

describe('StatusBadge', () => {
  it('renders the "Airing" label', () => {
    render(<StatusBadge status="airing" />)
    const badge = screen.getByTestId('status-badge')
    expect(badge).toHaveTextContent('Airing')
  })

  it('renders the "Finished" label', () => {
    render(<StatusBadge status="finished" />)
    expect(screen.getByTestId('status-badge')).toHaveTextContent('Finished')
  })

  it('renders the "Upcoming" label', () => {
    render(<StatusBadge status="upcoming" />)
    expect(screen.getByTestId('status-badge')).toHaveTextContent('Upcoming')
  })

  it('shows the live (ping) dot only for airing shows', () => {
    const { container: airing } = render(<StatusBadge status="airing" />)
    expect(airing.querySelector('.animate-ping')).not.toBeNull()

    const { container: finished } = render(<StatusBadge status="finished" />)
    expect(finished.querySelector('.animate-ping')).toBeNull()
  })
})

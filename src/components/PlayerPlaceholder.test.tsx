import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PlayerPlaceholder } from './PlayerPlaceholder'

describe('PlayerPlaceholder', () => {
  it('renders the placeholder region', () => {
    render(<PlayerPlaceholder />)
    expect(screen.getByTestId('player-placeholder')).toBeInTheDocument()
  })

  it('communicates that streaming is coming soon', () => {
    render(<PlayerPlaceholder />)
    expect(screen.getByText(/streaming coming soon/i)).toBeInTheDocument()
  })

  it('does NOT render a real <video> element', () => {
    const { container } = render(<PlayerPlaceholder title="Cowboy Bebop" />)
    expect(container.querySelector('video')).toBeNull()
  })

  it('uses an accessible label that includes the title when provided', () => {
    render(<PlayerPlaceholder title="Cowboy Bebop" />)
    const region = screen.getByTestId('player-placeholder')
    expect(region).toHaveAttribute('role', 'img')
    expect(region).toHaveAttribute(
      'aria-label',
      'Video player for Cowboy Bebop — streaming coming soon',
    )
  })

  it('uses a generic accessible label when no title is provided', () => {
    render(<PlayerPlaceholder />)
    expect(screen.getByTestId('player-placeholder')).toHaveAttribute(
      'aria-label',
      'Video player — streaming coming soon',
    )
  })
})

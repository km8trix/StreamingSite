import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SubDubBadges } from './SubDubBadges'

describe('SubDubBadges', () => {
  it('renders SUB and DUB badges with their counts', () => {
    render(<SubDubBadges subEpisodes={24} dubEpisodes={10} />)
    const sub = screen.getByTestId('badge-sub')
    const dub = screen.getByTestId('badge-dub')
    expect(sub).toHaveTextContent('24')
    expect(dub).toHaveTextContent('10')
  })

  it('gives SUB an accessible label with the count', () => {
    render(<SubDubBadges subEpisodes={24} dubEpisodes={10} />)
    expect(
      screen.getByLabelText('24 subtitled episodes'),
    ).toBeInTheDocument()
  })

  it('labels DUB with the count when dubs exist and applies the dub fill', () => {
    render(<SubDubBadges subEpisodes={24} dubEpisodes={10} />)
    const dub = screen.getByLabelText('10 dubbed episodes')
    expect(dub).toBeInTheDocument()
    expect(dub.className).toContain('bg-dub')
  })

  it('handles the dubEpisodes === 0 case as an explicit greyed "DUB 0"', () => {
    render(<SubDubBadges subEpisodes={24} dubEpisodes={0} />)
    const dub = screen.getByTestId('badge-dub')
    expect(dub).toHaveTextContent('0')
    expect(dub).toHaveAttribute('aria-label', 'No dubbed episodes')
    expect(dub.className).not.toContain('bg-dub')
  })

  it('respects the md size variant', () => {
    render(<SubDubBadges subEpisodes={1} dubEpisodes={1} size="md" />)
    const sub = screen.getByTestId('badge-sub')
    expect(sub.className).toContain('text-xs')
  })
})

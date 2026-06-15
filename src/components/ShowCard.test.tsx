import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ShowCard } from './ShowCard'
import { makeShowSummary } from '@/test/fixtures'

describe('ShowCard', () => {
  it('renders the title', () => {
    render(<ShowCard show={makeShowSummary({ title: 'Frieren' })} />)
    expect(screen.getByText('Frieren')).toBeInTheDocument()
  })

  it('renders the cover image with descriptive alt text', () => {
    render(
      <ShowCard
        show={makeShowSummary({
          title: 'Frieren',
          coverImage: 'https://cdn.example.com/frieren.jpg',
        })}
      />,
    )
    const img = screen.getByRole('img', { name: 'Frieren cover art' })
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute('alt', 'Frieren cover art')
  })

  it('renders a SUB n badge with the sub episode count', () => {
    render(<ShowCard show={makeShowSummary({ subEpisodes: 28 })} />)
    const sub = screen.getByTestId('badge-sub')
    expect(sub).toHaveTextContent(/SUB/)
    expect(sub).toHaveTextContent('28')
  })

  it('renders a DUB n badge with the dub episode count', () => {
    render(<ShowCard show={makeShowSummary({ dubEpisodes: 12 })} />)
    const dub = screen.getByTestId('badge-dub')
    expect(dub).toHaveTextContent(/DUB/)
    expect(dub).toHaveTextContent('12')
  })

  it('shows a greyed "DUB 0" badge when dubEpisodes === 0', () => {
    render(<ShowCard show={makeShowSummary({ dubEpisodes: 0 })} />)
    const dub = screen.getByTestId('badge-dub')
    // Still rendered (explicit absence), shows 0, and is labelled "no dubbed episodes".
    expect(dub).toHaveTextContent('0')
    expect(dub).toHaveAttribute('aria-label', 'No dubbed episodes')
    // Greyed/muted treatment rather than the pink dub fill.
    expect(dub.className).toContain('text-subtle')
    expect(dub.className).not.toContain('bg-dub')
  })

  it('links to the show detail page at /shows/[slug]', () => {
    render(<ShowCard show={makeShowSummary({ slug: 'frieren' })} />)
    const link = screen.getByTestId('show-card')
    expect(link.tagName).toBe('A')
    expect(link).toHaveAttribute('href', '/shows/frieren')
    expect(link).toHaveAttribute('data-slug', 'frieren')
  })

  it('falls back to an em dash when year is null', () => {
    render(<ShowCard show={makeShowSummary({ year: null })} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})

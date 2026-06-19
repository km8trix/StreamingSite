// WhereToWatch.test.tsx — official "where to watch" provider links.

import { render, screen, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { WhereToWatch } from './WhereToWatch'

afterEach(cleanup)

describe('WhereToWatch', () => {
  it('renders a safe external link per provider', () => {
    render(
      <WhereToWatch
        title="Frieren"
        links={[
          { site: 'Crunchyroll', url: 'https://www.crunchyroll.com/series/x', embeddable: false },
          { site: 'Netflix', url: 'https://www.netflix.com/title/1', embeddable: false },
        ]}
      />,
    )
    const links = screen.getAllByTestId('where-to-watch-link')
    expect(links).toHaveLength(2)
    expect(links[0]).toHaveAttribute('href', 'https://www.crunchyroll.com/series/x')
    expect(links[0]).toHaveAttribute('target', '_blank')
    expect(links[0]).toHaveAttribute('rel', 'noopener noreferrer')
    expect(screen.getByText('Crunchyroll')).toBeInTheDocument()
    expect(screen.getByText('Netflix')).toBeInTheDocument()
  })

  it('shows an empty state when there are no links', () => {
    render(<WhereToWatch title="Frieren" links={[]} />)
    expect(screen.getByTestId('where-to-watch-empty')).toBeInTheDocument()
    expect(screen.queryByTestId('where-to-watch-link')).not.toBeInTheDocument()
  })
})

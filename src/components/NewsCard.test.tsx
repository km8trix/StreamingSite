// NewsCard.test.tsx — presentational headline card.
//
// NewsCard renders one article as an external link (new tab, rel=noopener
// noreferrer) to its source. It shows a category chip (when set), the title, an
// optional summary, the source name, and a published date.

import { render, screen, cleanup, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { makeNewsArticle } from '@/test/fixtures'
import { NewsCard } from './NewsCard'

afterEach(cleanup)

describe('NewsCard', () => {
  it('renders the headline, summary, category, and source', () => {
    render(
      <NewsCard
        article={makeNewsArticle({
          title: 'Big Anime News',
          summary: 'Something noteworthy happened.',
          category: 'Industry',
          source: 'Anime News Network',
        })}
      />,
    )
    expect(screen.getByText('Big Anime News')).toBeInTheDocument()
    expect(screen.getByText('Something noteworthy happened.')).toBeInTheDocument()
    expect(screen.getByTestId('news-category')).toHaveTextContent('Industry')
    expect(screen.getByText('Anime News Network')).toBeInTheDocument()
  })

  it('is an external link to the source that opens in a new tab safely', () => {
    render(
      <NewsCard
        article={makeNewsArticle({
          sourceUrl: 'https://example.com/article',
        })}
      />,
    )
    const card = screen.getByTestId('news-card')
    expect(card).toHaveAttribute('href', 'https://example.com/article')
    expect(card).toHaveAttribute('target', '_blank')
    expect(card).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('formats the published date', () => {
    render(
      <NewsCard
        article={makeNewsArticle({ publishedAt: '2026-06-15T09:00:00.000Z' })}
      />,
    )
    // Renders the year; exact day can shift by server TZ but the year is stable.
    expect(screen.getByTestId('news-card').textContent).toContain('2026')
  })

  it('renders a chip even for an unknown category (fallback styling)', () => {
    render(<NewsCard article={makeNewsArticle({ category: 'Cosplay' })} />)
    expect(screen.getByTestId('news-category')).toHaveTextContent('Cosplay')
  })

  it('omits the category chip when the category is empty', () => {
    render(<NewsCard article={makeNewsArticle({ category: '' })} />)
    expect(screen.queryByTestId('news-category')).not.toBeInTheDocument()
  })

  it('marks the featured variant via data-featured', () => {
    render(<NewsCard article={makeNewsArticle()} featured />)
    expect(screen.getByTestId('news-card')).toHaveAttribute(
      'data-featured',
      'true',
    )
  })

  it('announces that the link opens in a new tab', () => {
    render(<NewsCard article={makeNewsArticle()} />)
    const card = screen.getByTestId('news-card')
    expect(within(card).getByText(/opens in a new tab/i)).toBeInTheDocument()
  })
})

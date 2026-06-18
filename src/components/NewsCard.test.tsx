// NewsCard.test.tsx — LiveChart-style headline row.
//
// NewsCard renders a row: a thumbnail (image or placeholder), the title, an
// excerpt, a tag, and a meta line (source domain · date). The whole row is an
// external link (new tab, rel="noopener noreferrer") to the source article.

import { render, screen, cleanup, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { makeNewsArticle } from '@/test/fixtures'
import { NewsCard } from './NewsCard'

afterEach(cleanup)

describe('NewsCard', () => {
  it('renders the headline, excerpt, tag, source domain (www stripped), and date', () => {
    render(
      <NewsCard
        article={makeNewsArticle({
          title: 'Big Anime News',
          summary: 'Something noteworthy happened.',
          category: 'One Piece',
          sourceUrl: 'https://www.animenewsnetwork.com/news/123',
          publishedAt: '2026-06-15T09:00:00.000Z',
        })}
      />,
    )
    expect(screen.getByText('Big Anime News')).toBeInTheDocument()
    expect(screen.getByText('Something noteworthy happened.')).toBeInTheDocument()
    expect(screen.getByTestId('news-tag')).toHaveTextContent('One Piece')
    expect(screen.getByTestId('news-source')).toHaveTextContent(
      'animenewsnetwork.com',
    )
    expect(screen.getByTestId('news-card').textContent).toContain('2026')
  })

  it('is a safe external link to the source', () => {
    render(
      <NewsCard
        article={makeNewsArticle({ sourceUrl: 'https://example.com/article' })}
      />,
    )
    const card = screen.getByTestId('news-card')
    expect(card).toHaveAttribute('href', 'https://example.com/article')
    expect(card).toHaveAttribute('target', '_blank')
    expect(card).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('renders the thumbnail image when imageUrl is set', () => {
    render(
      <NewsCard
        article={makeNewsArticle({
          imageUrl: 'https://cdn.myanimelist.net/s/common/x.jpg',
        })}
      />,
    )
    const thumb = screen.getByTestId('news-thumb')
    expect(thumb.querySelector('img')).toBeTruthy()
  })

  it('renders a placeholder thumbnail (no image) when imageUrl is null', () => {
    render(<NewsCard article={makeNewsArticle({ imageUrl: null })} />)
    const thumb = screen.getByTestId('news-thumb')
    expect(thumb.querySelector('img')).toBeFalsy()
  })

  it('announces that the link opens in a new tab', () => {
    render(<NewsCard article={makeNewsArticle()} />)
    expect(
      within(screen.getByTestId('news-card')).getByText(/opens in a new tab/i),
    ).toBeInTheDocument()
  })
})

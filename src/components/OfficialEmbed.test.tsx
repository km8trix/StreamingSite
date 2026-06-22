import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { OfficialEmbed } from './OfficialEmbed'

afterEach(cleanup)

describe('OfficialEmbed', () => {
  const src = 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'

  it('shows a play facade (no iframe) until clicked — keeps the player off the critical path', () => {
    render(<OfficialEmbed src={src} title="Frieren" />)
    expect(screen.getByTestId('official-embed').querySelector('iframe')).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Watch Frieren on YouTube' }),
    ).toBeInTheDocument()
  })

  it('injects the labelled, autoplaying, fullscreen iframe on click', () => {
    render(<OfficialEmbed src={src} title="Frieren" />)
    fireEvent.click(screen.getByRole('button', { name: 'Watch Frieren on YouTube' }))
    const iframe = screen.getByTestId('official-embed').querySelector('iframe')!
    expect(iframe).toHaveAttribute('src', `${src}?autoplay=1`)
    expect(iframe).toHaveAttribute('title', 'Watch Frieren on YouTube')
    expect(iframe).toHaveAttribute('allowfullscreen')
  })

  it('appends autoplay with & for a playlist src that already has a query', () => {
    const playlist =
      'https://www.youtube-nocookie.com/embed/videoseries?list=PLabc'
    render(<OfficialEmbed src={playlist} title="Frieren" />)
    fireEvent.click(screen.getByRole('button', { name: /watch frieren/i }))
    expect(
      screen.getByTestId('official-embed').querySelector('iframe'),
    ).toHaveAttribute('src', `${playlist}&autoplay=1`)
  })
})

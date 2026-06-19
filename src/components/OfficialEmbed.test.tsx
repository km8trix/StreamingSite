import { render, screen, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { OfficialEmbed } from './OfficialEmbed'

afterEach(cleanup)

describe('OfficialEmbed', () => {
  const src = 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'

  it('renders an iframe wired to the given embed src', () => {
    render(<OfficialEmbed src={src} title="Frieren" />)
    const iframe = screen.getByTestId('official-embed').querySelector('iframe')!
    expect(iframe).toHaveAttribute('src', src)
  })

  it('labels the iframe with the title and allows fullscreen + lazy-loads', () => {
    render(<OfficialEmbed src={src} title="Frieren" />)
    const iframe = screen.getByTestId('official-embed').querySelector('iframe')!
    expect(iframe).toHaveAttribute('title', 'Watch Frieren on YouTube')
    expect(iframe).toHaveAttribute('allowfullscreen')
    expect(iframe).toHaveAttribute('loading', 'lazy')
  })
})

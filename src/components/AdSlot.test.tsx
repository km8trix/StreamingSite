import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AdPlacement } from '@/lib/data/types'

// ---------------------------------------------------------------------------
// Roadmap: NON-INVASIVE ads — AdSlot rendering tests.
//
// AdSlot is an ASYNC Server Component: it awaits getAdForPlacement() and returns
// JSX. We await the component function directly, then render the returned tree
// (the standard way to unit-test an async RSC under Vitest/RTL).
//
// The PRODUCT REQUIREMENT under test is that ads are NON-INVASIVE and clearly
// labelled. So we assert, on the rendered output:
//   - a clearly-visible "Sponsored" disclosure label,
//   - a single link to the advertiser's target_url (the creative is clickable),
//   - NO modal / dialog / interstitial semantics (no role="dialog"/"alertdialog",
//     no aria-modal, no target="_blank" new-tab popup),
//   - NO autoplay surface (no <video>/<audio> element),
//   - a RESERVED, fixed-size box (aspect-ratio + max-width) so there is no layout
//     shift — present even when NO ad is served (the empty slot still reserves
//     its footprint).
//
// getAdForPlacement is mocked so the render is deterministic and offline.
// AdSlotTracker is mocked to a passthrough so we don't pull the client 'use
// server' tracking action chain into the jsdom render — AdSlot's own markup
// (label + link + reserved box) is what we're verifying.
// ---------------------------------------------------------------------------

const getAdForPlacementMock = vi.fn<() => Promise<AdPlacement | null>>()
vi.mock('@/lib/data', () => ({
  getAdForPlacement: () => getAdForPlacementMock(),
}))

// Passthrough tracker: render the children (the server-rendered creative) only.
vi.mock('./AdSlotTracker', () => ({
  AdSlotTracker: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="ad-tracker-stub">{children}</div>
  ),
}))

import { AdSlot } from './AdSlot'

const sampleAd: AdPlacement = {
  id: 'ad-001',
  placementKey: 'home-banner',
  name: 'House — Join the Forum',
  imageUrl: 'https://placehold.co/970x90/1a1a2e/8b5cf6?text=Join',
  targetUrl: '/forum',
  altText: 'Join the discussion on the Senpai forum',
  weight: 1,
}

// Render the async Server Component: await it to resolve the JSX, then render.
async function renderAdSlot(props: { placementKey: string; className?: string }) {
  const ui = await AdSlot(props)
  return render(ui)
}

beforeEach(() => {
  getAdForPlacementMock.mockReset()
})

describe('AdSlot — with an ad', () => {
  beforeEach(() => {
    getAdForPlacementMock.mockResolvedValue(sampleAd)
  })

  it('renders the ad-slot box with the correct placement', async () => {
    await renderAdSlot({ placementKey: 'home-banner' })
    const slot = screen.getByTestId('ad-slot')
    expect(slot).toBeInTheDocument()
    expect(slot).toHaveAttribute('data-placement', 'home-banner')
    // It is a filled slot, not the empty reserved placeholder.
    expect(slot).not.toHaveAttribute('data-ad-empty')
  })

  it('renders a clearly-visible "Sponsored" disclosure label', async () => {
    await renderAdSlot({ placementKey: 'home-banner' })
    const label = screen.getByTestId('ad-sponsored-label')
    expect(label).toBeInTheDocument()
    expect(label).toHaveTextContent(/sponsored/i)
  })

  it('renders a link to the ad target_url', async () => {
    await renderAdSlot({ placementKey: 'home-banner' })
    const link = screen.getByTestId('ad-slot-link')
    expect(link.tagName).toBe('A')
    expect(link).toHaveAttribute('href', '/forum')
  })

  it('renders the creative image with the ad alt text', async () => {
    await renderAdSlot({ placementKey: 'home-banner' })
    const img = screen.getByRole('img', {
      name: 'Join the discussion on the Senpai forum',
    })
    expect(img).toHaveAttribute(
      'src',
      expect.stringContaining('placehold.co'),
    )
  })

  it('reserves a fixed footprint (aspect-ratio + max-width) -> no layout shift', async () => {
    await renderAdSlot({ placementKey: 'home-banner' })
    const slot = screen.getByTestId('ad-slot')
    // home-banner is 970x90 — the reserved style fixes the box height.
    expect(slot.style.aspectRatio).toBe('970 / 90')
    expect(slot.style.maxWidth).toBe('970px')
  })

  // --- NON-INVASIVE guarantees -------------------------------------------

  it('renders NO modal / dialog / interstitial role', async () => {
    const { container } = await renderAdSlot({ placementKey: 'home-banner' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(container.querySelector('[role="dialog"]')).toBeNull()
    expect(container.querySelector('[role="alertdialog"]')).toBeNull()
    expect(container.querySelector('[aria-modal="true"]')).toBeNull()
  })

  it('does NOT open a new tab (no target="_blank" popup)', async () => {
    await renderAdSlot({ placementKey: 'home-banner' })
    const link = screen.getByTestId('ad-slot-link')
    expect(link).not.toHaveAttribute('target', '_blank')
    // rel guards an off-site creative.
    expect(link.getAttribute('rel')).toMatch(/sponsored/)
  })

  it('renders NO autoplay surface (no <video> or <audio> element)', async () => {
    const { container } = await renderAdSlot({ placementKey: 'home-banner' })
    expect(container.querySelector('video')).toBeNull()
    expect(container.querySelector('audio')).toBeNull()
    expect(container.querySelector('[autoplay]')).toBeNull()
  })

  it('renders exactly ONE link (the single clickable creative)', async () => {
    const { container } = await renderAdSlot({ placementKey: 'home-banner' })
    expect(container.querySelectorAll('a')).toHaveLength(1)
  })

  it('falls back to the ad name / generic alt when altText is absent', async () => {
    getAdForPlacementMock.mockResolvedValue({ ...sampleAd, altText: null })
    await renderAdSlot({ placementKey: 'home-banner' })
    // Falls back to the ad name for the alt text.
    expect(
      screen.getByRole('img', { name: 'House — Join the Forum' }),
    ).toBeInTheDocument()
  })

  it('uses the sidebar reserved size for a sidebar placement', async () => {
    getAdForPlacementMock.mockResolvedValue({
      ...sampleAd,
      placementKey: 'sidebar',
      targetUrl: '/signup',
    })
    await renderAdSlot({ placementKey: 'sidebar' })
    const slot = screen.getByTestId('ad-slot')
    expect(slot.style.aspectRatio).toBe('300 / 250')
  })
})

describe('AdSlot — no ad (empty slot)', () => {
  beforeEach(() => {
    getAdForPlacementMock.mockResolvedValue(null)
  })

  it('still renders the reserved box (no layout shift) with data-ad-empty', async () => {
    await renderAdSlot({ placementKey: 'home-banner' })
    const slot = screen.getByTestId('ad-slot')
    expect(slot).toBeInTheDocument()
    expect(slot).toHaveAttribute('data-ad-empty', 'true')
    // Footprint reserved identically to the filled case -> no CLS when it fills.
    expect(slot.style.aspectRatio).toBe('970 / 90')
    expect(slot.style.maxWidth).toBe('970px')
  })

  it('renders nothing invasive: no link, no label, no image, aria-hidden', async () => {
    const { container } = await renderAdSlot({ placementKey: 'home-banner' })
    expect(screen.queryByTestId('ad-slot-link')).toBeNull()
    expect(screen.queryByTestId('ad-sponsored-label')).toBeNull()
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('a')).toBeNull()
    // The empty reserved box is hidden from assistive tech.
    expect(screen.getByTestId('ad-slot')).toHaveAttribute('aria-hidden', 'true')
  })

  it('renders NO modal / dialog when empty either', async () => {
    const { container } = await renderAdSlot({ placementKey: 'home-banner' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(container.querySelector('[aria-modal]')).toBeNull()
  })
})

describe('AdSlot — labelled-as-advertisement region', () => {
  it('exposes an "Advertisement" aria-label on the filled slot', async () => {
    getAdForPlacementMock.mockResolvedValue(sampleAd)
    await renderAdSlot({ placementKey: 'home-banner' })
    const slot = screen.getByTestId('ad-slot')
    expect(slot).toHaveAttribute('aria-label', 'Advertisement')
    // The Sponsored label lives inside the slot.
    expect(
      within(slot).getByTestId('ad-sponsored-label'),
    ).toHaveTextContent(/sponsored/i)
  })
})

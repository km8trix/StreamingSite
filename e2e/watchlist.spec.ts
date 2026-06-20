import { expect, test } from '@playwright/test'

// M1 Slice 3 — Watchlist ("My List"). Guests can save shows to localStorage and
// see them in the home "My List" rail; signed-in users persist to the DB and
// merge their guest list on sign-in. This guest-only flow needs no auth, so it
// runs without a local Supabase session.

test.describe('Watchlist (guest)', () => {
  test('save a show, see it in My List on home, then remove it', async ({
    page,
  }) => {
    await page.goto('/')
    const slug = await page
      .getByTestId('show-card')
      .first()
      .getAttribute('data-slug')
    expect(slug).toBeTruthy()

    // Save from the show detail page.
    await page.goto(`/shows/${slug}`)
    const saveBtn = page.getByTestId('watchlist-button')
    await expect(saveBtn).toHaveAttribute('data-saved', 'false')
    await saveBtn.click()
    await expect(saveBtn).toHaveAttribute('data-saved', 'true')
    await expect(saveBtn).toContainText('In My List')

    // Home "My List" rail now surfaces the saved show, linking back to it.
    await page.goto('/')
    const rail = page.getByTestId('my-list-rail')
    await expect(rail).toBeVisible()
    const card = rail.getByTestId('watchlist-card').first()
    await expect(card).toHaveAttribute('href', `/shows/${slug}`)

    // Removing the only saved show empties the rail (it renders nothing).
    await rail.getByTestId('watchlist-remove').first().click()
    await expect(page.getByTestId('my-list-rail')).toHaveCount(0)

    // The show page reflects the removal after reload.
    await page.goto(`/shows/${slug}`)
    await expect(page.getByTestId('watchlist-button')).toHaveAttribute(
      'data-saved',
      'false',
    )
  })

  test('saved state survives a reload', async ({ page }) => {
    await page.goto('/')
    const slug = await page
      .getByTestId('show-card')
      .first()
      .getAttribute('data-slug')

    await page.goto(`/shows/${slug}`)
    await page.getByTestId('watchlist-button').click()
    await expect(page.getByTestId('watchlist-button')).toHaveAttribute(
      'data-saved',
      'true',
    )

    await page.reload()
    await expect(page.getByTestId('watchlist-button')).toHaveAttribute(
      'data-saved',
      'true',
    )
  })
})

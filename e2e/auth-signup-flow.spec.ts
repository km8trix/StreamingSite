import { expect, test } from '@playwright/test'

// M3 Feature 1 — AUTH signup-flow e2e (runs against the LIVE local Supabase).
//
// This is the QA-owned signup flow from the M3 testing strategy. It complements
// e2e/auth.spec.ts (which owns the signed-out chrome + the bundled profile-edit
// lifecycle) by isolating the core signup → signed-in → signout → signin path
// into discrete, independently-debuggable assertions.
//
// CONTRACT NOTES:
//   - Signup PERSISTS in the live DB, so we mint a UNIQUE email per run
//     (`pwtest+<timestamp>-<rand>@example.com`) to avoid cross-run collisions.
//     No DB reset is required; rows simply accumulate. To wipe: `npx supabase db reset`.
//   - enable_confirmations = false (supabase/config.toml) makes signup → signed-in
//     instant — no email round-trip.
//
// These tests share global signed-in state across routes, so they run serially.
test.describe('Auth — signup flow (live Supabase)', () => {
  test.describe.configure({ mode: 'serial' })

  // One unique identity for the whole serial block: the same account is created,
  // signed out of, and signed back into across the tests below.
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`
  const creds = {
    email: `pwtest+${stamp}@example.com`,
    username: `pwtest${stamp.replace(/\D/g, '').slice(-8)}`,
    password: 'secret123',
  }

  test('signing up a fresh account lands signed-in (header shows the user menu + username)', async ({
    page,
  }) => {
    await page.goto('/signup')
    await expect(page.getByTestId('signup-form')).toBeVisible()

    await page.getByTestId('email-input').fill(creds.email)
    await page.getByTestId('username-input').fill(creds.username)
    await page.getByTestId('password-input').fill(creds.password)

    // Submitting redirects to '/' on success.
    await Promise.all([
      page.waitForURL((url) => url.pathname === '/'),
      page.getByTestId('auth-submit').click(),
    ])

    // Header reflects the signed-in state: user menu present, no signin-link,
    // and the menu surfaces the chosen username.
    const menu = page.getByTestId('header-user-menu')
    await expect(menu).toBeVisible()
    await expect(page.getByTestId('signin-link')).toHaveCount(0)
    await expect(menu).toContainText(creds.username, { ignoreCase: true })
  })

  // Sign out is DETERMINISTIC: signOut() (server action, src/lib/auth/actions.ts)
  // calls supabase.auth.signOut() AND explicitly deletes every Supabase
  // auth-token cookie — the base `sb-<ref>-auth-token` plus every chunked
  // `…auth-token.0`/`.1` variant (@supabase/ssr splits a large JWT into chunks).
  // Previously only the base cookie was cleared, so the surviving chunks were
  // re-validated by middleware.ts `updateSession` -> getUser() on the redirect to
  // '/', re-rendering the header signed-in ~50% of runs. With the chunks now
  // cleared, clicking Sign out returns the user to the signed-out state every
  // time. This test clicks Sign out (no cookie-clearing workaround), reloads
  // several times asserting the signed-out chrome on each, and confirms no
  // `sb-*-auth-token*` cookie survives.
  test('clicking Sign out returns to the signed-out chrome and clears all auth cookies', async ({
    page,
  }) => {
    await page.goto('/signin')
    await page.getByTestId('email-input').fill(creds.email)
    await page.getByTestId('password-input').fill(creds.password)
    await Promise.all([
      page.waitForURL((url) => url.pathname === '/'),
      page.getByTestId('auth-submit').click(),
    ])

    const menu = page.getByTestId('header-user-menu')
    await expect(menu).toBeVisible()

    // Open the menu and click the real Sign out control.
    const toggle = menu.getByRole('button').first()
    const signout = page.getByTestId('signout-button')
    await expect(async () => {
      if (!(await signout.isVisible())) {
        await toggle.click()
      }
      await expect(signout).toBeVisible()
    }).toPass()

    // Wait for the sign-out server-action POST to COMPLETE (303 -> '/'). We wait
    // on the POST response, not waitForURL('/'), because the user is already on
    // '/' so a URL wait resolves instantly — before the sign-out finishes.
    await Promise.all([
      page.waitForResponse((r) => r.request().method() === 'POST'),
      signout.click(),
    ])

    // Reload several times — must be signed-out EVERY time (no flapping).
    for (let i = 0; i < 8; i++) {
      await page.goto('/')
      await expect(page.getByTestId('signin-link')).toBeVisible()
      await expect(page.getByTestId('header-user-menu')).toHaveCount(0)
    }

    // No Supabase auth-token cookie (base or chunk) survives sign-out.
    const survivors = (await page.context().cookies()).filter((c) =>
      /^sb-.*-auth-token(\.\d+)?$/.test(c.name),
    )
    expect(survivors).toEqual([])
  })

  test('signing in with the just-created credentials works', async ({ page }) => {
    await page.goto('/signin')
    await expect(page.getByTestId('signin-form')).toBeVisible()

    await page.getByTestId('email-input').fill(creds.email)
    await page.getByTestId('password-input').fill(creds.password)
    await Promise.all([
      page.waitForURL((url) => url.pathname === '/'),
      page.getByTestId('auth-submit').click(),
    ])

    const menu = page.getByTestId('header-user-menu')
    await expect(menu).toBeVisible()
    await expect(menu).toContainText(creds.username, { ignoreCase: true })
  })

  test('an invalid login shows an inline auth-error (and stays signed-out)', async ({
    page,
  }) => {
    await page.goto('/signin')
    // Right email, wrong password → Supabase rejects → inline auth-error.
    await page.getByTestId('email-input').fill(creds.email)
    await page.getByTestId('password-input').fill('definitely-the-wrong-password')
    await page.getByTestId('auth-submit').click()

    await expect(page.getByTestId('auth-error')).toBeVisible()
    // No session was established: still signed-out.
    await expect(page.getByTestId('header-user-menu')).toHaveCount(0)
  })
})

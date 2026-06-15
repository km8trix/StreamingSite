import { expect, test } from '@playwright/test'

// M3 Feature 1 — AUTH e2e (runs against the LIVE local Supabase).
//
// Signup PERSISTS, so each test that creates an account uses a unique email per
// run (timestamp + random). No DB reset is required between runs; the rows just
// accumulate. To wipe them: `npx supabase db reset`.
//
// enable_confirmations = false (supabase/config.toml) makes signup → signed-in
// instant, so these flows don't need an email round-trip.

function uniqueCreds() {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`
  return {
    email: `m3e2e.${stamp}@example.com`,
    username: `m3e2e${stamp.slice(-7)}`,
    password: 'secret123',
  }
}

// Return to the signed-out state by actually clicking the menu's "Sign out".
//
// The signOut() server action clears ALL Supabase auth-token cookies — the base
// `sb-<ref>-auth-token` AND every chunked `…auth-token.0`/`.1` variant — so the
// sign-out is DETERMINISTIC. (Previously only the base cookie was cleared, so
// the surviving chunks were re-validated by middleware and the header re-rendered
// signed-in ~50% of the time; that bug is now fixed.) We click Sign out, then
// reload several times asserting the signed-out chrome EVERY time, and confirm no
// `sb-*-auth-token*` cookies survive.
async function signOutViaMenu(page: import('@playwright/test').Page) {
  const menu = page.getByTestId('header-user-menu')
  const toggle = menu.getByRole('button').first()
  const signout = page.getByTestId('signout-button')

  await expect(menu).toBeVisible()
  await expect(toggle).toBeVisible()

  await expect(async () => {
    if (!(await signout.isVisible())) {
      await toggle.click()
    }
    await expect(signout).toBeVisible()
  }).toPass()

  // Click Sign out and wait for the server-action POST to COMPLETE (it returns
  // 303 -> '/'). We wait on the POST response rather than waitForURL('/')
  // because the user is already on '/', so a URL wait would resolve instantly —
  // before the sign-out round-trip finishes — and race the reloads below.
  await Promise.all([
    page.waitForResponse((r) => r.request().method() === 'POST'),
    signout.click(),
  ])

  // Signed-out chrome must render, and stay signed-out across reloads.
  for (let i = 0; i < 8; i++) {
    await page.goto('/')
    await expect(page.getByTestId('signin-link')).toBeVisible()
    await expect(page.getByTestId('header-user-menu')).toHaveCount(0)
  }

  // No Supabase auth-token cookie (base or chunk) should survive.
  const survivors = (await page.context().cookies()).filter((c) =>
    /^sb-.*-auth-token(\.\d+)?$/.test(c.name),
  )
  expect(survivors).toEqual([])
}

test.describe('Auth — signed-out chrome', () => {
  test('header shows a Sign in link when signed out', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('signin-link')).toBeVisible()
    await expect(page.getByTestId('header-user-menu')).toHaveCount(0)
  })

  test('Sign in link navigates to /signin', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('signin-link').click()
    await page.waitForURL('**/signin')
    await expect(page.getByTestId('signin-form')).toBeVisible()
  })

  test('signin and signup pages link to each other', async ({ page }) => {
    await page.goto('/signin')
    await expect(page.getByTestId('signin-form')).toBeVisible()
    // /signin → /signup via the "Create an account" link.
    await page.getByRole('link', { name: /create an account/i }).click()
    await page.waitForURL('**/signup')
    await expect(page.getByTestId('signup-form')).toBeVisible()
    // /signup → /signin via the "Sign in" link (scope to the form to avoid the
    // header's own signin-link).
    await page.getByTestId('signup-form').getByRole('link', { name: /^sign in$/i }).click()
    await page.waitForURL('**/signin')
    await expect(page.getByTestId('signin-form')).toBeVisible()
  })

  test('signed-out /profile redirects to /signin', async ({ page }) => {
    await page.goto('/profile')
    await page.waitForURL('**/signin')
    await expect(page.getByTestId('signin-form')).toBeVisible()
  })

  test('bad credentials show an inline auth error', async ({ page }) => {
    await page.goto('/signin')
    await page.getByTestId('email-input').fill('nobody@example.com')
    await page.getByTestId('password-input').fill('wrongpassword')
    await page.getByTestId('auth-submit').click()
    await expect(page.getByTestId('auth-error')).toBeVisible()
  })
})

test.describe('Auth — full account lifecycle', () => {
  // These tests create accounts and toggle global signed-in state; run them
  // serially so parallel workers don't interleave sign-in/out on shared routes.
  test.describe.configure({ mode: 'serial' })

  test('sign up → signed-in header → edit profile → sign out → sign back in', async ({
    page,
  }) => {
    const { email, username, password } = uniqueCreds()

    // --- Sign up -----------------------------------------------------------
    await page.goto('/signup')
    await expect(page.getByTestId('signup-form')).toBeVisible()
    await page.getByTestId('email-input').fill(email)
    await page.getByTestId('username-input').fill(username)
    await page.getByTestId('password-input').fill(password)
    await Promise.all([
      page.waitForURL((url) => url.pathname === '/'),
      page.getByTestId('auth-submit').click(),
    ])

    // --- Signed-in header --------------------------------------------------
    const menu = page.getByTestId('header-user-menu')
    await expect(menu).toBeVisible()
    await expect(page.getByTestId('signin-link')).toHaveCount(0)
    await expect(menu).toContainText(username, { ignoreCase: true })

    // Open the menu: Profile link + Sign out button present.
    await menu.getByRole('button').first().click()
    await expect(page.getByTestId('signout-button')).toBeVisible()
    await expect(page.getByRole('menuitem', { name: /profile/i })).toBeVisible()

    // --- Profile page + edit ----------------------------------------------
    await page.goto('/profile')
    await expect(page.getByTestId('profile-save')).toBeVisible()
    await page.getByTestId('profile-display-name').fill('E2E Tester')
    await page.getByTestId('profile-save').click()
    await expect(page.getByTestId('profile-success')).toBeVisible()

    // The new display name surfaces in the header menu after revalidation.
    await page.goto('/')
    await expect(page.getByTestId('header-user-menu')).toContainText('E2E Tester')

    // --- Sign out ----------------------------------------------------------
    await signOutViaMenu(page)
    await expect(page.getByTestId('header-user-menu')).toHaveCount(0)

    // --- Sign back in with the same credentials ---------------------------
    await page.goto('/signin')
    await page.getByTestId('email-input').fill(email)
    await page.getByTestId('password-input').fill(password)
    await Promise.all([
      page.waitForURL((url) => url.pathname === '/'),
      page.getByTestId('auth-submit').click(),
    ])
    await expect(page.getByTestId('header-user-menu')).toBeVisible()
  })

  test('claiming a taken username on /profile shows an inline error', async ({
    page,
  }) => {
    // The handle_new_user() trigger DEDUPES usernames at signup (appends a
    // numeric suffix) rather than failing, so the real "username already taken"
    // path is updateProfile's unique-violation (23505) mapping on /profile.
    // Two users: the first claims a username; the second tries to take it.
    const first = uniqueCreds()
    const second = uniqueCreds()

    // User A signs up with an explicit username, then we clear their session.
    await page.goto('/signup')
    await page.getByTestId('email-input').fill(first.email)
    await page.getByTestId('username-input').fill(first.username)
    await page.getByTestId('password-input').fill(first.password)
    await Promise.all([
      page.waitForURL((url) => url.pathname === '/'),
      page.getByTestId('auth-submit').click(),
    ])
    await expect(page.getByTestId('header-user-menu')).toBeVisible()
    // Programmatic sign-out (deterministic — avoids the menu UI race).
    await page.context().clearCookies()

    // User B signs up (gets a deduped username), then tries to claim A's.
    await page.goto('/signup')
    await page.getByTestId('email-input').fill(second.email)
    await page.getByTestId('password-input').fill(second.password)
    await Promise.all([
      page.waitForURL((url) => url.pathname === '/'),
      page.getByTestId('auth-submit').click(),
    ])

    await page.goto('/profile')
    await page.getByTestId('profile-display-name').fill('Collision Tester')
    // Username field lives on the action but not this form by default — submit
    // the taken username through a direct field if present; otherwise drive the
    // action via the page's form by adding the username through the URL is not
    // possible, so we use the username input rendered on profile if available.
    const usernameField = page.getByTestId('profile-username')
    await expect(usernameField).toBeVisible()
    await usernameField.fill(first.username)
    await page.getByTestId('profile-save').click()
    await expect(page.getByTestId('profile-error')).toContainText(/taken/i)
  })
})

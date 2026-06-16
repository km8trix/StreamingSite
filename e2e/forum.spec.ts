import { expect, test } from '@playwright/test'

// M3 Feature 3 — FORUM e2e (runs against the LIVE local Supabase).
//
// Covers the forum UI lifecycle:
//   - signed-out: /forum lists categories; a category page renders threads/empty
//     state + a sign-in prompt and NO new-thread form; a thread page (if any)
//     renders posts + a sign-in prompt and NO reply composer;
//   - signed-in: sign up a fresh user → /forum → open a category → create a
//     thread → see it in the list → open it → reply → see the reply.
//
// CONTRACT NOTES (same as auth/comments):
//   - Signup PERSISTS in the live DB → mint a UNIQUE email per run. Thread/post
//     rows also persist; `npx supabase db reset` wipes accounts + forum content
//     (and re-seeds the 4 categories).
//   - enable_confirmations = false → signup is instantly signed-in.

test.describe('Forum — signed-out', () => {
  test('the forum index lists the seeded categories', async ({ page }) => {
    await page.goto('/forum')
    await expect(page.getByTestId('forum-categories')).toBeVisible()
    // Four categories are seeded (General, Seasonal, Recommendations, Feedback).
    const cards = page.getByTestId('category-card')
    expect(await cards.count()).toBeGreaterThanOrEqual(4)
  })

  test('a category page shows a sign-in prompt and NO new-thread form', async ({
    page,
  }) => {
    await page.goto('/forum')
    await page.getByTestId('category-card').first().click()
    await page.waitForURL(/\/forum\/[^/]+$/)
    // The "New thread" affordance (auth-gated) is not present when signed out.
    await expect(page.getByTestId('new-thread-button')).toHaveCount(0)
    await expect(page.getByTestId('new-thread-form')).toHaveCount(0)
    // A sign-in prompt is shown instead.
    await expect(page.getByRole('link', { name: /sign in to post/i })).toBeVisible()
  })
})

test.describe('Forum — signed-in lifecycle (live Supabase)', () => {
  test.describe.configure({ mode: 'serial' })

  const stamp = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`
  const creds = {
    email: `forumtest+${stamp}@example.com`,
    username: `frm${stamp.replace(/\D/g, '').slice(-8)}`,
    password: 'secret123',
  }
  const threadTitle = `Smoke thread ${stamp}`
  const threadBody = `First post body ${stamp}`
  const reply = `Reply body ${stamp}`

  test('sign up, open a category, create a thread, see it, open it, reply', async ({
    page,
  }) => {
    // --- sign up (instantly signed in) ----------------------------------
    await page.goto('/signup')
    await page.getByTestId('email-input').fill(creds.email)
    await page.getByTestId('username-input').fill(creds.username)
    await page.getByTestId('password-input').fill(creds.password)
    await Promise.all([
      page.waitForURL((url) => url.pathname === '/'),
      page.getByTestId('auth-submit').click(),
    ])
    await expect(page.getByTestId('header-user-menu')).toBeVisible()

    // --- open the forum and pick the first category ---------------------
    await page.goto('/forum')
    await expect(page.getByTestId('forum-categories')).toBeVisible()
    await page.getByTestId('category-card').first().click()
    await page.waitForURL(/\/forum\/[^/]+$/)

    // --- the new-thread affordance is shown (auth-gated) ----------------
    const newThreadButton = page.getByTestId('new-thread-button')
    await expect(newThreadButton).toBeVisible()
    await newThreadButton.click()
    const form = page.getByTestId('new-thread-form')
    await expect(form).toBeVisible()

    // --- create a thread (navigates to the new thread on success) -------
    await form.getByTestId('thread-title-input').fill(threadTitle)
    await form.getByTestId('thread-body-input').fill(threadBody)
    await Promise.all([
      page.waitForURL(/\/forum\/thread\/[^/]+$/),
      form.getByTestId('new-thread-submit').click(),
    ])

    // --- the thread page shows the title + first post -------------------
    await expect(page.getByRole('heading', { name: threadTitle })).toBeVisible()
    await expect(page.getByTestId('thread-posts')).toBeVisible()
    await expect(
      page.getByTestId('post-body').filter({ hasText: threadBody }),
    ).toBeVisible()

    // --- the thread appears back in the category list -------------------
    await page.goBack() // back to the category page
    await page.waitForURL(/\/forum\/[^/]+$/)
    await expect(page.getByTestId('thread-list')).toBeVisible()
    const row = page
      .getByTestId('thread-row')
      .filter({ hasText: threadTitle })
      .first()
    await expect(row).toBeVisible()

    // --- open it again and reply ----------------------------------------
    await row.click()
    await page.waitForURL(/\/forum\/thread\/[^/]+$/)
    const composer = page.getByTestId('reply-composer')
    await expect(composer).toBeVisible()
    await composer.getByTestId('reply-body-input').fill(reply)
    await Promise.all([
      page.waitForResponse((r) => r.request().method() === 'POST'),
      composer.getByTestId('reply-submit').click(),
    ])

    // --- the reply is visible -------------------------------------------
    await expect(
      page.getByTestId('post-body').filter({ hasText: reply }),
    ).toBeVisible()
    // Both the original post and the reply are present (2 posts in the thread).
    expect(await page.getByTestId('post-item').count()).toBeGreaterThanOrEqual(2)
  })

  test('a signed-out visitor sees the thread content but NO reply composer', async ({
    page,
    context,
  }) => {
    // Find the thread we created above (it persists in the live DB), then view it
    // as a signed-out visitor. Clearing cookies drops the session server-side.
    await context.clearCookies()
    await page.goto('/forum')
    // Walk categories to locate our thread row (created in the prior test).
    const card = page.getByTestId('category-card').first()
    await card.click()
    await page.waitForURL(/\/forum\/[^/]+$/)

    const row = page
      .getByTestId('thread-row')
      .filter({ hasText: threadTitle })
      .first()
    await expect(row).toBeVisible()
    await row.click()
    await page.waitForURL(/\/forum\/thread\/[^/]+$/)

    // Content is visible (public read), but the reply composer is gated.
    await expect(page.getByTestId('thread-posts')).toBeVisible()
    await expect(
      page.getByTestId('post-body').filter({ hasText: threadBody }),
    ).toBeVisible()
    await expect(page.getByTestId('reply-composer')).toHaveCount(0)
    await expect(page.getByRole('link', { name: /sign in to reply/i })).toBeVisible()
  })
})

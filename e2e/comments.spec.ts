import { expect, test } from '@playwright/test'
import seed from '../src/lib/data/seed.json'

// M3 Feature 2 — COMMENTS e2e (runs against the LIVE local Supabase).
//
// Covers the comments UI on a show detail page: the signed-out sign-in prompt,
// posting a top-level comment, replying (one level of threading), editing one's
// own comment, and soft-deleting it ("[deleted]").
//
// CONTRACT NOTES (same as the auth flow):
//   - Signup PERSISTS in the live DB → mint a UNIQUE email per run. Comment rows
//     also persist; `npx supabase db reset` wipes both accounts and comments.
//   - enable_confirmations = false → signup is instantly signed-in.
//
// A real show id/slug is read from the seed so the test tracks the catalog.

const show = (seed as { shows: { id: string; slug: string }[] }).shows[0]
const SHOW_PATH = `/shows/${show.slug}`

test.describe('Comments — signed-out', () => {
  test('a show page shows the comments section + a sign-in prompt (no composer)', async ({
    page,
  }) => {
    await page.goto(SHOW_PATH)
    await expect(page.getByTestId('comments-section')).toBeVisible()
    await expect(page.getByTestId('comments-signin-prompt')).toBeVisible()
    await expect(page.getByTestId('comment-composer')).toHaveCount(0)
  })
})

test.describe('Comments — signed-in lifecycle (live Supabase)', () => {
  test.describe.configure({ mode: 'serial' })

  test('sign up, post a comment, reply, edit, then soft-delete it', async ({
    page,
  }) => {
    // This serial lifecycle does a full signup + four PERSISTED mutations, each
    // followed by a poll-until-rendered reload (below). Under full-parallel load
    // any one reload+render can be slow, so give the whole test generous head-
    // room rather than letting the 30s default time out mid-poll. (Test-only.)
    test.setTimeout(120_000)

    // Mint UNIQUE credentials + content PER TEST RUN (not at module load) so the
    // same spec under `--repeat-each` doesn't reuse an already-registered email
    // (a duplicate signup yields no session) or collide on comment text. This is
    // the "unique per run" contract note applied per-invocation.
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`
    const creds = {
      email: `cmttest+${stamp}@example.com`,
      username: `cmt${stamp.replace(/\D/g, '').slice(-8)}`,
      password: 'secret123',
    }
    const original = `Smoke comment ${stamp}`
    const edited = `Edited comment ${stamp}`
    const reply = `Reply ${stamp}`

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

    // --- the composer is shown (auth-gated) instead of the prompt -------
    await page.goto(SHOW_PATH)
    const composer = page.getByTestId('comment-composer').first()
    await expect(composer).toBeVisible()
    await expect(page.getByTestId('comments-signin-prompt')).toHaveCount(0)

    // --- post a top-level comment ---------------------------------------
    // ROBUST WAIT (test-timing fix): the action's POST can resolve BEFORE the
    // revalidated RSC re-render paints in place, AND under full-parallel load a
    // single reload can still race the commit — the matched POST may not be the
    // action's own, or the fresh RSC render simply lags past the assert timeout.
    // So wait for a POST to land, then POLL a fresh server render: reload until
    // the row appears. The row is persisted the moment the action commits, so a
    // later reload renders it deterministically and retrying a premature reload
    // self-corrects.
    await composer.locator('textarea').fill(original)
    await Promise.all([
      page.waitForResponse((r) => r.request().method() === 'POST'),
      composer.getByTestId('comment-submit').click(),
    ])
    await expect(async () => {
      await page.reload()
      await expect(
        page.getByTestId('comment-body').filter({ hasText: original }),
      ).toBeVisible({ timeout: 8000 })
    }).toPass({ timeout: 30000 })

    // The comment is authored by this user → owner affordances present.
    const item = page
      .getByTestId('comment-item')
      .filter({ hasText: original })
      .first()
    await expect(item.getByTestId('comment-edit')).toBeVisible()
    await expect(item.getByTestId('comment-delete')).toBeVisible()
    await expect(item.getByTestId('comment-reply')).toBeVisible()

    // --- reply to it (one level of threading) ---------------------------
    await item.getByTestId('comment-reply').click()
    const replyComposer = item.getByTestId('comment-composer')
    await replyComposer.locator('textarea').fill(reply)
    await Promise.all([
      page.waitForResponse((r) => r.request().method() === 'POST'),
      replyComposer.getByTestId('comment-submit').click(),
    ])
    await expect(async () => {
      await page.reload()
      await expect(
        page.getByTestId('comment-body').filter({ hasText: reply }),
      ).toBeVisible({ timeout: 8000 })
    }).toPass({ timeout: 30000 })

    // --- edit the top-level comment -------------------------------------
    const topItem = page
      .getByTestId('comment-item')
      .filter({ hasText: original })
      .first()
    await topItem.getByTestId('comment-edit').click()
    const editInput = topItem.getByTestId('comment-edit-input')
    await editInput.fill(edited)
    await Promise.all([
      page.waitForResponse((r) => r.request().method() === 'POST'),
      topItem.getByTestId('comment-edit-save').click(),
    ])
    await expect(async () => {
      await page.reload()
      await expect(
        page.getByTestId('comment-body').filter({ hasText: edited }),
      ).toBeVisible({ timeout: 8000 })
      await expect(page.getByText('(edited)').first()).toBeVisible()
    }).toPass({ timeout: 30000 })

    // --- soft-delete it -> "[deleted]" ----------------------------------
    const editedItem = page
      .getByTestId('comment-item')
      .filter({ hasText: edited })
      .first()
    await editedItem.getByTestId('comment-delete').click()
    await Promise.all([
      page.waitForResponse((r) => r.request().method() === 'POST'),
      editedItem.getByTestId('comment-delete-confirm').click(),
    ])
    await expect(async () => {
      await page.reload()
      await expect(page.getByText('[deleted]').first()).toBeVisible({
        timeout: 8000,
      })
      // The original (edited) text is gone from the page.
      await expect(page.getByText(edited)).toHaveCount(0)
    }).toPass({ timeout: 30000 })
  })
})

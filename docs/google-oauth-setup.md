# Sign in with Google (OAuth) — setup

The code for "Continue with Google" is already wired up:

- **Action** — `signInWithGoogle` in `src/lib/auth/actions.ts` → `supabase.auth.signInWithOAuth({ provider: 'google' })`.
- **Callback** — `src/app/auth/callback/route.ts` exchanges the `?code` for a session.
- **UI** — `GoogleSignInButton` on `/signin` and `/signup`.
- **Profiles** — migration `0008_oauth_profile_metadata.sql` makes the new-user
  trigger pull `display_name`/`avatar_url` from the Google profile.

What's left is **dashboard configuration** (this requires logging into Google
Cloud and Supabase). Do these three things once.

> **Note on email confirmation.** You chose to keep email confirmation **on**.
> That setting only affects **email/password** signups. Google users arrive with
> a Google-verified email, so OAuth gives them a session immediately — they are
> **not** blocked by the confirmation requirement. No change needed.

---

## 1. Create a Google OAuth client (Google Cloud Console)

1. Go to <https://console.cloud.google.com/> → create/select a project.
2. **APIs & Services → OAuth consent screen**: configure it (External), add an
   app name, support email, and your domain. Add your email as a **test user**
   while the app is in "Testing", or **Publish** it for public use.
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Web application**.
   - **Authorized JavaScript origins**: your site origin(s), e.g.
     `https://senpai.vercel.app` and `http://localhost:3000`.
   - **Authorized redirect URI** — this points at **Supabase**, not your app:
     ```
     https://<YOUR-PROJECT-REF>.supabase.co/auth/v1/callback
     ```
     (Find `<YOUR-PROJECT-REF>` in your Supabase project URL. For **local**
     Supabase it's `http://127.0.0.1:54321/auth/v1/callback`.)
4. Copy the generated **Client ID** and **Client secret**.

## 2. Enable the Google provider (Supabase dashboard)

1. Supabase dashboard → **Authentication → Sign In / Providers → Google**.
2. Toggle **Enable**, paste the **Client ID** and **Client secret** from step 1,
   **Save**.
3. **Authentication → URL Configuration**:
   - **Site URL**: your **actual** production origin (the exact domain users
     visit), e.g. `https://your-app.vercel.app`.
   - **Redirect URLs** (allowlist): add every origin's callback, e.g.
     ```
     https://your-app.vercel.app/auth/callback
     http://localhost:3000/auth/callback
     ```
     These must be the real domains you serve from. The app derives its
     `redirectTo` automatically from the request host, so there is **no app env
     var to set** — just make sure the domain you browse is allow‑listed here.

> No `NEXT_PUBLIC_SITE_URL` (or any app env var) is needed for OAuth — the redirect
> origin is taken from the live request host. (Earlier versions used that env var;
> a value that didn't match the real domain silently sent the session to the wrong
> host. That dependency has been removed.)

---

## Apply the new migration

Run `supabase/migrations/0008_oauth_profile_metadata.sql` against your database
(Supabase SQL editor, or `supabase db push` / `psql`). It's idempotent.

## Quick test

1. Open `/signin` → **Continue with Google**.
2. You're sent to Google → consent → back to `/auth/callback` → home, signed in.
3. Open the profile menu — your Google display name/avatar should appear.

### Troubleshooting

| Symptom | Likely cause |
|---|---|
| `redirect_uri_mismatch` on Google's screen | The Supabase callback URI in step 1.3 doesn't exactly match `https://<ref>.supabase.co/auth/v1/callback`. |
| Bounced to `/signin?error=...` | The exchange failed — usually the domain you browse (its `/auth/callback`) isn't in Supabase's **Redirect URLs** allowlist (step 2.3). |
| "Unsupported provider" / provider disabled | Google provider not enabled/saved in step 2. |
| Signed in but no avatar/name | Migration `0008` not applied to that database. |

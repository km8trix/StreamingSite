import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How Senpai collects, uses, and protects your data.',
  alternates: { canonical: '/privacy' },
}

export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p>Last updated: June 22, 2026</p>

      <h2>1. Data we collect</h2>
      <ul>
        <li>
          <strong>Account data</strong> — your email and profile details when you
          sign up (including via Google sign-in).
        </li>
        <li>
          <strong>Activity data</strong> — watchlist, watch progress, comments,
          and forum posts you create.
        </li>
        <li>
          <strong>Analytics</strong> — aggregate usage data, collected only after
          you accept optional analytics cookies.
        </li>
      </ul>

      <h2>2. Cookies</h2>
      <p>
        We use <strong>essential cookies</strong> to keep you signed in; these are
        required for the Service to function. We use <strong>optional analytics
        cookies</strong> only with your consent — you can decline them in the
        cookie banner, and the Service still works fully.
      </p>

      <h2>3. How we use your data</h2>
      <p>
        To operate the Service: authenticate you, save your lists and progress,
        display your community contributions, and — with consent — understand
        aggregate usage to improve the product. We do not sell your personal data.
      </p>

      <h2>4. Third parties</h2>
      <p>
        We rely on service providers including Supabase (database and auth),
        Vercel (hosting and analytics), and AniList/MyAnimeList (catalog data).
        Outbound links to streaming providers are governed by their own policies.
      </p>

      <h2>5. Your rights</h2>
      <p>
        Depending on your jurisdiction (e.g. GDPR/CCPA), you may request access to,
        correction of, or deletion of your personal data. To make a request,
        contact us at <a href="mailto:privacy@example.com">privacy@example.com</a>.
        Automated export and deletion flows are planned (see our roadmap).
      </p>

      <h2>6. Data retention</h2>
      <p>
        We retain account and activity data while your account is active and for a
        reasonable period afterward, unless you request deletion sooner.
      </p>

      <h2>7. Contact</h2>
      <p>
        Privacy questions: <a href="mailto:privacy@example.com">privacy@example.com</a>.
      </p>
    </>
  )
}

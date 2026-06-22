import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'The terms governing your use of Senpai.',
  alternates: { canonical: '/terms' },
}

export default function TermsPage() {
  return (
    <>
      <h1>Terms of Service</h1>
      <p>Last updated: June 22, 2026</p>

      <h2>1. Acceptance of terms</h2>
      <p>
        By accessing or using Senpai (the &ldquo;Service&rdquo;), you agree to be
        bound by these Terms of Service. If you do not agree, do not use the
        Service.
      </p>

      <h2>2. What Senpai is</h2>
      <p>
        Senpai is a discovery and community platform for anime. It surfaces
        catalog information and links out to official, licensed providers where a
        title can be watched. Senpai does not host or stream licensed video.
      </p>

      <h2>3. Accounts</h2>
      <p>
        You are responsible for activity under your account and for keeping your
        credentials secure. You must be old enough to form a binding contract in
        your jurisdiction to create an account.
      </p>

      <h2>4. User content and conduct</h2>
      <p>
        You retain ownership of comments and forum posts you submit, and grant us
        a license to display them within the Service. You agree not to post
        unlawful, infringing, harassing, or spam content. We may remove content
        or suspend accounts that violate these terms or our community guidelines.
      </p>

      <h2>5. Third-party links and embeds</h2>
      <p>
        The Service links to and embeds third-party content (e.g. official
        provider pages and YouTube). We are not responsible for third-party
        content or practices; your use of those services is governed by their
        terms.
      </p>

      <h2>6. Disclaimers and limitation of liability</h2>
      <p>
        The Service is provided &ldquo;as is&rdquo; without warranties of any
        kind. To the fullest extent permitted by law, we are not liable for
        indirect or consequential damages arising from your use of the Service.
      </p>

      <h2>7. Changes</h2>
      <p>
        We may update these terms from time to time. Continued use after changes
        take effect constitutes acceptance.
      </p>

      <h2>8. Contact</h2>
      <p>
        Questions about these terms: <a href="mailto:legal@example.com">legal@example.com</a>.
      </p>
    </>
  )
}

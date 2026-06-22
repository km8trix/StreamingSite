import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'DMCA Policy',
  description: 'How to report copyright infringement on Senpai.',
  alternates: { canonical: '/dmca' },
}

export default function DmcaPage() {
  return (
    <>
      <h1>DMCA Policy</h1>
      <p>Last updated: June 22, 2026</p>

      <h2>Our position</h2>
      <p>
        Senpai does not host licensed video. We surface catalog information and
        link out to official, licensed providers. We respect the intellectual
        property of others and respond to valid notices under the Digital
        Millennium Copyright Act (DMCA).
      </p>

      <h2>Filing a takedown notice</h2>
      <p>
        If you believe content on the Service (for example, a user comment or
        forum post) infringes your copyright, send a written notice to our
        designated agent that includes:
      </p>
      <ul>
        <li>Your physical or electronic signature.</li>
        <li>Identification of the copyrighted work claimed to be infringed.</li>
        <li>
          Identification of the infringing material and its location on the
          Service (a URL is best).
        </li>
        <li>Your contact information (address, telephone, email).</li>
        <li>
          A statement that you have a good-faith belief the use is not authorized.
        </li>
        <li>
          A statement, under penalty of perjury, that the information is accurate
          and that you are the owner or authorized to act on the owner&rsquo;s
          behalf.
        </li>
      </ul>

      <h2>Designated agent</h2>
      <p>
        DMCA Agent, Senpai<br />
        Email: <a href="mailto:dmca@example.com">dmca@example.com</a>
      </p>
      <p>
        <strong>Before launch:</strong> register this designated agent with the
        U.S. Copyright Office and replace the placeholder contact above with the
        registered details.
      </p>

      <h2>Counter-notice</h2>
      <p>
        If your content was removed and you believe it was a mistake or
        misidentification, you may submit a counter-notice to the same agent with
        the information required by the DMCA.
      </p>

      <h2>Repeat infringers</h2>
      <p>
        We may terminate the accounts of users who are repeat infringers.
      </p>
    </>
  )
}

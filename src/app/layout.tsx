import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { SiteHeader } from '@/components/SiteHeader'
import { SiteFooter } from '@/components/SiteFooter'
import { getMetadataBaseUrl } from '@/lib/metadata'
import { CookieConsent } from '@/components/CookieConsent'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  // The stable production origin for absolute OG / canonical URLs (no longer the
  // `senpai.example` placeholder). See src/lib/metadata.ts.
  metadataBase: getMetadataBaseUrl(),
  title: {
    default: 'Senpai — Anime Streaming',
    template: '%s · Senpai',
  },
  description:
    'Browse a curated anime catalog with sub and dub episode counts. Discover trending and recommended series, or roll the dice with Randomize.',
  applicationName: 'Senpai',
  openGraph: {
    title: 'Senpai — Anime Streaming',
    description:
      'Browse a curated anime catalog with sub and dub episode counts.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Senpai — Anime Streaming',
    description:
      'Browse a curated anime catalog with sub and dub episode counts.',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-accent-foreground"
        >
          Skip to content
        </a>
        <SiteHeader />
        <main id="main-content" className="flex-1">
          {children}
        </main>
        <SiteFooter />
        {/* Mounts Vercel Analytics only after cookie consent is accepted. */}
        <CookieConsent />
      </body>
    </html>
  )
}

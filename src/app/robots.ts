import type { MetadataRoute } from 'next'
import { getMetadataBaseUrl } from '@/lib/metadata'

// robots.txt served at /robots.txt. Allow crawling of public content; keep the
// API, auth callback, and account pages out of the index. Points crawlers at the
// sitemap on the canonical production origin.

export default function robots(): MetadataRoute.Robots {
  const base = getMetadataBaseUrl().origin
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/auth/', '/profile'],
    },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  }
}

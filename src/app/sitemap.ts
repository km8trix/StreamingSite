import type { MetadataRoute } from 'next'
import seed from '@/lib/data/seed.json'
import { getMetadataBaseUrl } from '@/lib/metadata'

// XML sitemap served at /sitemap.xml. Enumerated from the bundled seed (NOT the
// live DB) so generation never depends on Supabase being reachable — mirrors the
// build-safe generateStaticParams() on the show page. Absolute URLs are built
// off the canonical production origin (getMetadataBaseUrl), so previews and local
// builds still emit production URLs (correct for a sitemap).

type SeedShow = { slug: string; updatedAt?: string }
type SeedGenre = { slug: string }

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getMetadataBaseUrl().origin
  const now = new Date()

  const shows = (seed.shows ?? []) as SeedShow[]
  const genres = (seed.genres ?? []) as SeedGenre[]

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/shows`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/schedule`, lastModified: now, changeFrequency: 'daily', priority: 0.7 },
    { url: `${base}/news`, lastModified: now, changeFrequency: 'hourly', priority: 0.6 },
    { url: `${base}/forum`, lastModified: now, changeFrequency: 'daily', priority: 0.5 },
  ]

  const showRoutes: MetadataRoute.Sitemap = shows.map((s) => ({
    url: `${base}/shows/${s.slug}`,
    lastModified: s.updatedAt ? new Date(s.updatedAt) : now,
    changeFrequency: 'weekly',
    priority: 0.8,
  }))

  const genreRoutes: MetadataRoute.Sitemap = genres.map((g) => ({
    url: `${base}/genre/${g.slug}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.4,
  }))

  return [...staticRoutes, ...showRoutes, ...genreRoutes]
}

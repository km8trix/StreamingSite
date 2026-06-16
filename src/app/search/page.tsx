import { redirect } from 'next/navigation'

interface SearchPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * /search is no longer a separate destination — the catalog lives at /shows,
 * which handles both browsing and ?q= search results. This route preserves any
 * query string and permanently redirects there, so the header typeahead, old
 * links, and bookmarks (e.g. /search?q=frieren) all keep working.
 */
export default async function SearchPage({ searchParams }: SearchPageProps) {
  const raw = await searchParams
  const sp = new URLSearchParams()
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'string') sp.set(key, value)
    else if (Array.isArray(value)) value.forEach((v) => sp.append(key, v))
  }
  const qs = sp.toString()
  redirect(qs ? `/shows?${qs}` : '/shows')
}

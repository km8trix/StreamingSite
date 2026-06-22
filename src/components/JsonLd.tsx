// Renders a JSON-LD structured-data <script>. Scrubs `<` → its unicode escape so
// a value containing `</script>` (or any HTML) can't break out of the tag — the
// XSS guard from Next's JSON-LD guidance. Server component; no client JS.
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, '\\u003c'),
      }}
    />
  )
}

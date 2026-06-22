import type { ReactNode } from 'react'

/**
 * Legal route-group layout — a readable prose column for Terms, Privacy, and
 * DMCA, under the global SiteHeader/SiteFooter. The draft notice applies to all
 * three documents until counsel-reviewed copy replaces them (see M0).
 */
export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6 lg:px-8">
      <p
        role="note"
        className="mb-8 rounded-card border border-dashed border-border bg-card/40 px-4 py-3 text-sm text-muted"
      >
        ⚠️ <strong className="text-foreground">Draft.</strong> These are
        placeholder documents and not legal advice. Replace with
        counsel-reviewed text before launch.
      </p>
      <article className="space-y-6 text-sm leading-relaxed text-muted [&_a]:text-accent-strong [&_a]:underline [&_h1]:text-3xl [&_h1]:font-extrabold [&_h1]:tracking-tight [&_h1]:text-foreground [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-foreground [&_li]:ml-5 [&_li]:list-disc [&_p]:mt-3 [&_strong]:text-foreground">
        {children}
      </article>
    </div>
  )
}

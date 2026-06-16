/**
 * AuthDivider — the "or" separator between the Google button and the
 * email/password form on the auth pages. Decorative; the label is hidden from
 * assistive tech (the two forms are already distinct landmarks).
 */
export function AuthDivider({ label = 'or' }: { label?: string }) {
  return (
    <div className="my-5 flex items-center gap-3" aria-hidden>
      <span className="h-px flex-1 bg-border" />
      <span className="text-xs font-medium uppercase tracking-wide text-subtle">
        {label}
      </span>
      <span className="h-px flex-1 bg-border" />
    </div>
  )
}
